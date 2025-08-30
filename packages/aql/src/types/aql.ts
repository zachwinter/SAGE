import { Operation } from "./operations";

export interface AQLQuery {
  name: string;
  parameters: Parameter[];
  operations: Operation[];
}

export interface Parameter {
  name: string;
  type: AQLType;
  defaultValue?: any;
  required: boolean;
}

export interface AQLType {
  kind: "primitive" | "collection" | "custom";
  name: string;
  elementType?: AQLType;
  properties?: Record<string, AQLType>;
}
