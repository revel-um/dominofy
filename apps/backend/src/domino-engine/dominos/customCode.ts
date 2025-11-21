// domino-engine/dominos/customCode.domino.ts
import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";
import { VM } from 'vm2';

export class CustomCodeDomino implements DominoExecutable {
  id: string;
  type = "codeRunner" as const;
  private functionName?: string;
  private codeString?: string;
  private variableMap: Record<string, { name: string; defaultValue: any }> = {}; // variableId -> {name, defaultValue}

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.functionName = node.data?.FunctionName?.value;
    this.codeString = node.data?.Code?.value;
    
    // Extract variables from data and map by variable ID
    Object.keys(node.data || {}).forEach(key => {
      if (key.startsWith('Variable_') && key.endsWith('_name')) {
        const variableId = key.replace('Variable_', '').replace('_name', '');
        const nameKey = `Variable_${variableId}_name`;
        const valueKey = `Variable_${variableId}_value`;
        
        const variableName = node.data?.[nameKey]?.value;
        const variableValue = node.data?.[valueKey]?.value;
        
        if (variableName) {
          this.variableMap[variableId] = {
            name: variableName,
            defaultValue: variableValue
          };
        }
      }
    });
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    console.log('ctx', ctx);
    
    try {
      const runtimeVariables: Record<string, any> = {};
      
      // Process each variable by ID to determine final name and value
      Object.keys(this.variableMap).forEach(variableId => {
        const variable = this.variableMap[variableId];
        const valueFieldKey = `Variable_${variableId}_value`;
        
        // Variable name always comes from stored field (not connected)
        const finalVariableName = variable.name;
        
        // Variable value: use connected value if available, otherwise use default
        const hasConnectedValue = ctx.input[valueFieldKey] !== undefined;
        const finalVariableValue = hasConnectedValue ? ctx.input[valueFieldKey] : variable.defaultValue;
        
        // Only add to runtime variables if we have a valid name
        if (finalVariableName) {
          runtimeVariables[finalVariableName] = finalVariableValue;
        }
      });

      const codeToExecute = ctx.input.Code || this.codeString;
      const functionName = ctx.input.FunctionName || this.functionName;

      if (!codeToExecute || !functionName) {
        throw new Error("Missing code or function name");
      }

      // Create a secure VM context
      const vm = new VM({
        timeout: 5000, // 5 second timeout
        sandbox: {
          ...runtimeVariables,
          console: {
            log: (...args: any[]) => console.log(`[CustomCode:${this.id}]`, ...args),
            error: (...args: any[]) => console.error(`[CustomCode:${this.id}]`, ...args),
            warn: (...args: any[]) => console.warn(`[CustomCode:${this.id}]`, ...args),
          }
        }
      });

      // Execute the code and get the result
      const result = vm.run(`
        (function() {
          ${codeToExecute}
          if (typeof ${functionName} === 'function') {
            return ${functionName}();
          } else {
            throw new Error('Function ${functionName} is not defined or not a function');
          }
        })()
      `);

      return {
        id: this.id,
        output: result,
        startedAt,
        finishedAt: Date.now()
      };

    } catch (error) {
      console.error(`[CustomCodeDomino:${this.id}] Error:`, error);
      
      return {
        id: this.id,
        output: { 
          error: error instanceof Error ? error.message : String(error),
          type: 'execution_error'
        },
        startedAt,
        finishedAt: Date.now(),
        nextChainKeys: ["exec_out_error"]
      };
    }
  }
}