import { appSchema, tableSchema } from '@nozbe/watermelondb';
import { SCHEMA_VERSION, schemaDefinition } from '@turnos/models';

type SchemaColumn = {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean';
  readonly isOptional?: boolean;
};

function toColumns(columns: readonly SchemaColumn[]) {
  return columns.map((column) => ({
    name: column.name,
    type: column.type,
    ...(column.isOptional === undefined ? {} : { isOptional: column.isOptional }),
  }));
}

export const databaseSchema = appSchema({
  version: SCHEMA_VERSION,
  tables: Object.entries(schemaDefinition.tables).map(([name, definition]) =>
    tableSchema({
      name,
      columns: toColumns(definition.columns),
    })
  ),
});
