import { dbAll, dbExec } from '../db/index.js';
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

    // Check if table exists
    const tableExists = await dbAll(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
      [tableName]
    );
    
    if (tableExists.length === 0) {
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
    const tables = await dbAll(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
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

    // Check if table exists
    const tableExists = await dbAll(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
      [tableName]
    );
    
    if (tableExists.length === 0) {
      throw new Error(`Table '${tableName}' does not exist`);
    }
    
    const columns = await dbAll(`PRAGMA table_info("${tableName}")`);
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