#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Import database utils
import { initDatabase, closeDatabase, getDatabaseMetadata } from './db/index.js';

// Import handlers
import { handleListResources, handleReadResource } from './handlers/resourceHandlers.js';
import { handleListTools, handleToolCall } from './handlers/toolHandlers.js';

// Setup a logger that uses stderr instead of stdout to avoid interfering with MCP communications
const logger = {
  log: (...args: any[]) => console.error('[INFO]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
  warn: (...args: any[]) => console.error('[WARN]', ...args),
  info: (...args: any[]) => console.error('[INFO]', ...args),
};

// Configure the server
const server = new Server(
  {
    name: "executeautomation/database-server",
    version: "1.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  },
);

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  logger.error("Please provide database connection information");
  logger.error("Usage for SQLite: node index.js <database_file_path>");
  logger.error("Usage for SQL Server: node index.js --sqlserver --server <server> --database <database> [--user <user> --password <password>]");
  logger.error("Usage for PostgreSQL: node index.js --postgresql --host <host> --database <database> [--user <user> --password <password> --port <port>]");
  logger.error("Usage for MySQL: node index.js --mysql --host <host> --database <database> [--user <user> --password <password> --port <port>]");
  process.exit(1);
}

// Parse arguments to determine database type and connection info
let dbType = 'sqlite';
let connectionInfo: any = null;

// Check if using SQL Server
if (args.includes('--sqlserver')) {
  dbType = 'sqlserver';
  connectionInfo = {
    server: '',
    database: '',
    user: undefined,
    password: undefined
  };
  
  // Parse SQL Server connection parameters
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--server' && i + 1 < args.length) {
      connectionInfo.server = args[i + 1];
    } else if (args[i] === '--database' && i + 1 < args.length) {
      connectionInfo.database = args[i + 1];
    } else if (args[i] === '--user' && i + 1 < args.length) {
      connectionInfo.user = args[i + 1];
    } else if (args[i] === '--password' && i + 1 < args.length) {
      connectionInfo.password = args[i + 1];
    } else if (args[i] === '--port' && i + 1 < args.length) {
      connectionInfo.port = parseInt(args[i + 1], 10);
    }
  }
  
  // Validate SQL Server connection info
  if (!connectionInfo.server || !connectionInfo.database) {
    logger.error("Error: SQL Server requires --server and --database parameters");
    process.exit(1);
  }
} 
// Check if using PostgreSQL
else if (args.includes('--postgresql') || args.includes('--postgres')) {
  dbType = 'postgresql';
  connectionInfo = {
    host: '',
    database: '',
    user: undefined,
    password: undefined,
    port: undefined,
    ssl: undefined,
    connectionTimeout: undefined
  };
  
  // Parse PostgreSQL connection parameters
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--host' && i + 1 < args.length) {
      connectionInfo.host = args[i + 1];
    } else if (args[i] === '--database' && i + 1 < args.length) {
      connectionInfo.database = args[i + 1];
    } else if (args[i] === '--user' && i + 1 < args.length) {
      connectionInfo.user = args[i + 1];
    } else if (args[i] === '--password' && i + 1 < args.length) {
      connectionInfo.password = args[i + 1];
    } else if (args[i] === '--port' && i + 1 < args.length) {
      connectionInfo.port = parseInt(args[i + 1], 10);
    } else if (args[i] === '--ssl' && i + 1 < args.length) {
      connectionInfo.ssl = args[i + 1] === 'true';
    } else if (args[i] === '--connection-timeout' && i + 1 < args.length) {
      connectionInfo.connectionTimeout = parseInt(args[i + 1], 10);
    }
  }
  
  // Validate PostgreSQL connection info
  if (!connectionInfo.host || !connectionInfo.database) {
    logger.error("Error: PostgreSQL requires --host and --database parameters");
    process.exit(1);
  }
}
// Check if using MySQL
else if (args.includes('--mysql')) {
  dbType = 'mysql';
  connectionInfo = {
    host: '',
    database: '',
    user: undefined,
    password: undefined,
    port: undefined,
    ssl: undefined,
    connectionTimeout: undefined
  };
  // Parse MySQL connection parameters
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--host' && i + 1 < args.length) {
      connectionInfo.host = args[i + 1];
    } else if (args[i] === '--database' && i + 1 < args.length) {
      connectionInfo.database = args[i + 1];
    } else if (args[i] === '--user' && i + 1 < args.length) {
      connectionInfo.user = args[i + 1];
    } else if (args[i] === '--password' && i + 1 < args.length) {
      connectionInfo.password = args[i + 1];
    } else if (args[i] === '--port' && i + 1 < args.length) {
      connectionInfo.port = parseInt(args[i + 1], 10);
    } else if (args[i] === '--ssl' && i + 1 < args.length) {
      const sslVal = args[i + 1];
      if (sslVal === 'true') connectionInfo.ssl = true;
      else if (sslVal === 'false') connectionInfo.ssl = false;
      else connectionInfo.ssl = sslVal;
    } else if (args[i] === '--connection-timeout' && i + 1 < args.length) {
      connectionInfo.connectionTimeout = parseInt(args[i + 1], 10);
    }
  }
  // Validate MySQL connection info
  if (!connectionInfo.host || !connectionInfo.database) {
    logger.error("Error: MySQL requires --host and --database parameters");
    process.exit(1);
  }
} // Check if using MariaDB
else if (args.includes('--mariadb')) {
  dbType = 'mariadb';
  connectionInfo = {
    host: '',
    database: '',
    user: undefined,
    password: undefined,
    port: undefined,
    ssl: undefined,
    connectionTimeout: undefined
  };
  // Parse MySQL connection parameters
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--host' && i + 1 < args.length) {
      connectionInfo.host = args[i + 1];
    } else if (args[i] === '--database' && i + 1 < args.length) {
      connectionInfo.database = args[i + 1];
    } else if (args[i] === '--user' && i + 1 < args.length) {
      connectionInfo.user = args[i + 1];
    } else if (args[i] === '--password' && i + 1 < args.length) {
      connectionInfo.password = args[i + 1];
    } else if (args[i] === '--port' && i + 1 < args.length) {
      connectionInfo.port = parseInt(args[i + 1], 10);
    } else if (args[i] === '--ssl' && i + 1 < args.length) {
      const sslVal = args[i + 1];
      if (sslVal === 'true') connectionInfo.ssl = true;
      else if (sslVal === 'false') connectionInfo.ssl = false;
      else connectionInfo.ssl = sslVal;
    } else if (args[i] === '--connection-timeout' && i + 1 < args.length) {
      connectionInfo.connectionTimeout = parseInt(args[i + 1], 10);
    }
  }
  // Validate MySQL connection info
  if (!connectionInfo.host || !connectionInfo.database) {
    logger.error("Error: MariaDB requires --host and --database parameters");
    process.exit(1);
  }
} else {
  // SQLite mode (default)
  dbType = 'sqlite';
  connectionInfo = args[0]; // First argument is the SQLite file path
  logger.info(`Using SQLite database at path: ${connectionInfo}`);
}

// Set up request handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return await handleListResources();
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  return await handleReadResource(request.params.uri);
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return handleListTools();
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  return await handleToolCall(request.params.name, request.params.arguments);
});

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

// Add global error handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

/**
 * Start the server
 */
async function runServer() {
  try {
    logger.info(`Initializing ${dbType} database...`);
    if (dbType === 'sqlite') {
      logger.info(`Database path: ${connectionInfo}`);
    } else if (dbType === 'sqlserver') {
      logger.info(`Server: ${connectionInfo.server}, Database: ${connectionInfo.database}`);
    } else if (dbType === 'postgresql') {
      logger.info(`Host: ${connectionInfo.host}, Database: ${connectionInfo.database}`);
    } else if (dbType === 'mysql') {
      logger.info(`Host: ${connectionInfo.host}, Database: ${connectionInfo.database}`);
    }
    
    // Initialize the database
    await initDatabase(connectionInfo, dbType);
    
    const dbInfo = getDatabaseMetadata();
    logger.info(`Connected to ${dbInfo.name} database`);
    
    logger.info('Starting MCP server...');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logger.info('Server running. Press Ctrl+C to exit.');
  } catch (error) {
    logger.error("Failed to initialize:", error);
    process.exit(1);
  }
}

// Start the server
runServer().catch(error => {
  logger.error("Server initialization failed:", error);
  process.exit(1);
}); 