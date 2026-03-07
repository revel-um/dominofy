// domino-engine/registry.ts
import { PipelineStep } from "../../../../shared/types/pipelineStepType";
import { DominoExecutable } from "./domino-engine.type";
import { AggregatorDomino } from "./dominos/aggregator";
import { ApiCallDomino } from "./dominos/apiCall";
import { ApiTriggerDomino } from "./dominos/apiTrigger";
import { ArithmeticDomino } from "./dominos/arithmetic";
import { ConditionDomino } from "./dominos/condition";
import ConnectorDomino from "./dominos/connector";
import { DeconstructorDomino } from "./dominos/deconstructor";
import { IteratorDomino } from "./dominos/iterator";

// Import each domino implementation class:
import { PrintDomino } from "./dominos/print";
import { ReadExcelDomino } from "./dominos/readExcel";
import { SlackTriggerDomino } from "./dominos/slackTrigger";
import { SwitchCaseDomino } from "./dominos/switchCase";
import { FilterDomino } from "./dominos/filter";
import { SlackActionDomino } from "./dominos/slackAction";
import { CsvWriterDomino } from "./dominos/csvWriter";
import { EmailActionDomino } from "./dominos/emailAction";
import { EmailTriggerDomino } from "./dominos/emailTrigger";
import { MapperDomino } from "./dominos/mapper";
import { DelayDomino } from "./dominos/delay";
import { CustomCodeDomino } from "./dominos/customCode";
import { SchedulerDomino } from "./dominos/scheduler";
import { GoogleDriveDomino } from "./dominos/googleDrive";
import { GoogleDriveDownloadDomino } from "./dominos/googleDriveDownload";
import { PaymentCreateRecipientDomino } from "./dominos/paymentCreateRecipient";
import { PaymentAddBankInstrumentDomino } from "./dominos/paymentAddBankInstrument";
import { PaymentAddUpiInstrumentDomino } from "./dominos/paymentAddUpiInstrument";
import { PaymentSinglePayoutDomino } from "./dominos/paymentSinglePayout";
import { PaymentBulkPayoutDomino } from "./dominos/paymentBulkPayout";
import { PaymentWaitForCompletionDomino } from "./dominos/paymentWaitForCompletion";

type DominoCtor = new (node: PipelineStep) => DominoExecutable;

class DominoRegistry {
  private readonly map = new Map<string, DominoCtor>();

  constructor() {
    // Register each type → its class constructor:
    this.register("apicall", ApiCallDomino);
    this.register("print", PrintDomino);
    this.register("apitrigger", ApiTriggerDomino);
    this.register("readexcel", ReadExcelDomino);
    this.register("condition", ConditionDomino);
    this.register("arithmetic", ArithmeticDomino);
    this.register("switchcase", SwitchCaseDomino);
    this.register("iterator", IteratorDomino);
    this.register("deconstructor", DeconstructorDomino);
    this.register("aggregator", AggregatorDomino);
    this.register("slacktrigger", SlackTriggerDomino);
    this.register("slackaction", SlackActionDomino);
    this.register("emailsender", EmailActionDomino);
    this.register("emailaction", EmailActionDomino);
    this.register("emailtrigger", EmailTriggerDomino);
    this.register("connector", ConnectorDomino);
    this.register("filter", FilterDomino);
    this.register("csvwriter", CsvWriterDomino);
    this.register("mapper", MapperDomino);
    this.register("delay", DelayDomino);
    this.register("codeRunner", CustomCodeDomino);
    this.register("SchedulerDomino", SchedulerDomino);
    this.register("googleDrive", GoogleDriveDomino);
    this.register("googleDriveDownload", GoogleDriveDownloadDomino);
    this.register("paymentCreateRecipient", PaymentCreateRecipientDomino);
    this.register("paymentAddBankInstrument", PaymentAddBankInstrumentDomino);
    this.register("paymentAddUpiInstrument", PaymentAddUpiInstrumentDomino);
    this.register("paymentSinglePayout", PaymentSinglePayoutDomino);
    this.register("paymentBulkPayout", PaymentBulkPayoutDomino);
    this.register("paymentWaitForCompletion", PaymentWaitForCompletionDomino);
  }

  public register(type: string, ctor: DominoCtor) {
    if (this.map.has(type)) {
      throw new Error(`Domino type "${type}" already registered`);
    }
    this.map.set(type, ctor);
  }

  public instantiate(node: PipelineStep): DominoExecutable {
    const ctor = this.map.get(node.type);
    if (!ctor) {
      throw new Error(`Unknown domino type "${node.type}"`);
    }
    return new ctor(node);
  }
}

export const dominoRegistry = new DominoRegistry();
