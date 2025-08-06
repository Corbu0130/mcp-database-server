import { dbAll, dbExec, getListTablesQuery, getDescribeTableQuery } from '../db/index.js';
import { formatSuccessResponse } from '../utils/formatUtils.js';

/**
 * Create a new table in the database
 * @param query CREATE TABLE SQL statement
 * @returns Result of the operation
 */
export async function createTable(query: string) {
  try {
    if (!query.trim().toLowerCase().startsWith("create table")) {
      throw new Error("Only CREATE TABLE statements are allowed");
    }

    await dbExec(query);
    return formatSuccessResponse({ success: true, message: "Table created successfully" });
  } catch (error: any) {
    throw new Error(`SQL Error: ${error.message}`);
  }
}

/**
 * Alter an existing table schema
 * @param query ALTER TABLE SQL statement
 * @returns Result of the operation
 */
export async function alterTable(query: string) {
  try {
    if (!query.trim().toLowerCase().startsWith("alter table")) {
      throw new Error("Only ALTER TABLE statements are allowed");
    }

    await dbExec(query);
    return formatSuccessResponse({ success: true, message: "Table altered successfully" });
  } catch (error: any) {
    throw new Error(`SQL Error: ${error.message}`);
  }
}

/**
 * Drop a table from the database
 * @param tableName Name of the table to drop
 * @param confirm Safety confirmation flag
 * @returns Result of the operation
 */
export async function dropTable(tableName: string, confirm: boolean) {
  try {
    if (!tableName) {
      throw new Error("Table name is required");
    }
    
    if (!confirm) {
      return formatSuccessResponse({ 
        success: false, 
        message: "Safety confirmation required. Set confirm=true to proceed with dropping the table." 
      });
    }

    // First check if table exists by directly querying for tables
    const query = getListTablesQuery();
    const tables = await dbAll(query);
    const tableNames = tables.map(t => t.name);
    
    if (!tableNames.includes(tableName)) {
      throw new Error(`Table '${tableName}' does not exist`);
    }
    
    // Drop the table
    await dbExec(`DROP TABLE "${tableName}"`);
    
    return formatSuccessResponse({ 
      success: true, 
      message: `Table '${tableName}' dropped successfully` 
    });
  } catch (error: any) {
    throw new Error(`Error dropping table: ${error.message}`);
  }
}

/**
 * List all tables in the database
 * @returns Array of table names
 */
export async function listTables() {
  try {
    // Use adapter-specific query for listing tables
    const query = getListTablesQuery();
    const tables = await dbAll(query);
    return formatSuccessResponse(tables.map((t) => t.name));
  } catch (error: any) {
    throw new Error(`Error listing tables: ${error.message}`);
  }
}

/**
 * Get schema information for a specific table
 * @param tableName Name of the table to describe
 * @returns Column definitions for the table
 */
export async function describeTable(tableName: string) {
  try {
    if (!tableName) {
      throw new Error("Table name is required");
    }

    // First check if table exists by directly querying for tables
    const query = getListTablesQuery();
    const tables = await dbAll(query);
    const tableNames = tables.map(t => t.name);
    
    if (!tableNames.includes(tableName)) {
      throw new Error(`Table '${tableName}' does not exist`);
    }
    
    // Use adapter-specific query for describing tables
    const descQuery = getDescribeTableQuery(tableName);
    const columns = await dbAll(descQuery);
    
    return formatSuccessResponse(columns.map((col) => ({
      name: col.name,
      type: col.type,
      notnull: !!col.notnull,
      default_value: col.dflt_value,
      primary_key: !!col.pk
    })));
  } catch (error: any) {
    throw new Error(`Error describing table: ${error.message}`);
  }
} 

/**
 * Find foreign keys that connect a list of tables in MariaDB
 * @param tableNames Array of table names to find connections for
 * @returns Array of foreign key relationships
 */
export async function findTableConnections(tableNames: string[]) {
  try {
    if (!tableNames || tableNames.length === 0) {
      throw new Error("At least one table name is required");
    }

    // Validate that all tables exist
    const query = getListTablesQuery();
    const tables = await dbAll(query);
    const existingTableNames = tables.map(t => t.name);
    
    const invalidTables = tableNames.filter(name => !existingTableNames.includes(name));
    if (invalidTables.length > 0) {
      throw new Error(`Tables not found: ${invalidTables.join(', ')}`);
    }

    // Query to find foreign keys that connect the specified tables
    // This query looks for foreign keys where either the referenced table or the table containing the foreign key
    // is in our list of tables
    const fkQuery = `
      SELECT 
        TABLE_NAME as table_name,
        COLUMN_NAME as column_name,
        REFERENCED_TABLE_NAME as referenced_table_name,
        REFERENCED_COLUMN_NAME as referenced_column_name,
        CONSTRAINT_NAME as constraint_name
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_NAME IS NOT NULL
        AND (
          TABLE_NAME IN (${tableNames.map(() => '?').join(',')})
          OR REFERENCED_TABLE_NAME IN (${tableNames.map(() => '?').join(',')})
        )
      ORDER BY TABLE_NAME, COLUMN_NAME
    `;

    const params = [...tableNames, ...tableNames]; // Parameters for both IN clauses
    const foreignKeys = await dbAll(fkQuery, params);

    // Group foreign keys by their connection type
    const connections: {
      internal_connections: Array<{
        from_table: string;
        from_column: string;
        to_table: string;
        to_column: string;
        constraint_name: string;
      }>;
      external_references: Array<{
        from_table: string;
        from_column: string;
        to_table: string;
        to_column: string;
        constraint_name: string;
      }>;
      external_referenced: Array<{
        from_table: string;
        from_column: string;
        to_table: string;
        to_column: string;
        constraint_name: string;
      }>;
    } = {
      internal_connections: [], // Foreign keys between tables in the list
      external_references: [], // Foreign keys from external tables to our tables
      external_referenced: []  // Foreign keys from our tables to external tables
    };

    for (const fk of foreignKeys) {
      const isInternal = tableNames.includes(fk.table_name) && tableNames.includes(fk.referenced_table_name);
      
      if (isInternal) {
        connections.internal_connections.push({
          from_table: fk.table_name,
          from_column: fk.column_name,
          to_table: fk.referenced_table_name,
          to_column: fk.referenced_column_name,
          constraint_name: fk.constraint_name
        });
      } else if (tableNames.includes(fk.table_name)) {
        connections.external_referenced.push({
          from_table: fk.table_name,
          from_column: fk.column_name,
          to_table: fk.referenced_table_name,
          to_column: fk.referenced_column_name,
          constraint_name: fk.constraint_name
        });
      } else {
        connections.external_references.push({
          from_table: fk.table_name,
          from_column: fk.column_name,
          to_table: fk.referenced_table_name,
          to_column: fk.referenced_column_name,
          constraint_name: fk.constraint_name
        });
      }
    }

    return formatSuccessResponse({
      requested_tables: tableNames,
      total_connections_found: foreignKeys.length,
      connections: connections,
      summary: {
        internal_connections_count: connections.internal_connections.length,
        external_references_count: connections.external_references.length,
        external_referenced_count: connections.external_referenced.length
      }
    });
  } catch (error: any) {
    throw new Error(`Error finding table connections: ${error.message}`);
  }
} 