// domino-engine/dominos/customCode.domino.ts
import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";
import { VM } from 'vm2';

export class CustomCodeDomino implements DominoExecutable {
  id: string;
  type = "codeRunner" as const;
  private functionName?: string;
  private codeString?: string;
  private variables: Record<string, any> = {};

  constructor(node: PipelineStep) {
    console.log("Initializing CustomCodeDomino with node:", node);
    this.id = node.id;
    this.functionName = node.data?.FunctionName?.value;
    this.codeString = node.data?.Code?.value;
    
    // Extract variables from data
    Object.keys(node.data || {}).forEach(key => {
      if (key.startsWith('Variable_') && key.endsWith('_name')) {
        const variableId = key.replace('Variable_', '').replace('_name', '');
        const nameKey = `Variable_${variableId}_name`;
        const valueKey = `Variable_${variableId}_value`;
        
        const variableName = node.data?.[nameKey]?.value;
        const variableValue = node.data?.[valueKey]?.value;
        
        if (variableName) {
          this.variables[variableName] = variableValue;
        }
      }
    });
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    
    try {
      // Get dynamic inputs or use default values
      const runtimeVariables = { ...this.variables };
      
      // Override with dynamic inputs from context
      Object.keys(ctx.input).forEach(key => {
        if (key.startsWith('var_name_')) {
          const variableId = key.replace('var_name_', '');
          const valuePinKey = `var_value_${variableId}`;
          const variableName = ctx.input[key];
          const variableValue = ctx.input[valuePinKey];
          
          if (variableName && variableValue !== undefined) {
            runtimeVariables[variableName] = variableValue;
          }
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