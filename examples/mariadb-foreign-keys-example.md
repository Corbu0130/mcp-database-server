# MariaDB Foreign Key Connections Example

This example demonstrates how to use the new `find_table_connections` tool to discover foreign key relationships between tables in a MariaDB database.

## Setup

1. Start the MCP server with MariaDB connection:
```bash
node dist/src/index.js --type mariadb --host localhost --database your_database --user your_user --password your_password
```

2. Configure Claude Desktop with the MCP server:
```json
{
  "mcpServers": {
    "mariadb": {
      "command": "node",
      "args": [
        "dist/src/index.js",
        "--type", "mariadb",
        "--host", "localhost",
        "--database", "your_database",
        "--user", "your_user",
        "--password", "your_password"
      ]
    }
  }
}
```

## Example Database Schema

Consider a typical e-commerce database with the following tables:

```sql
-- Users table
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT
);

-- Products table
CREATE TABLE products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category_id INT,
  created_by INT,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Orders table
CREATE TABLE orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'processing', 'shipped', 'delivered') DEFAULT 'pending',
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Order items table
CREATE TABLE order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

## Using the find_table_connections Tool

### Example 1: Find connections between core tables
**Prompt:** "Find all foreign key connections between the users, products, and orders tables"

**Tool Call:**
```json
{
  "name": "find_table_connections",
  "arguments": {
    "table_names": ["users", "products", "orders"]
  }
}
```

**Expected Response:**
```json
{
  "requested_tables": ["users", "products", "orders"],
  "total_connections_found": 3,
  "connections": {
    "internal_connections": [
      {
        "from_table": "orders",
        "from_column": "user_id",
        "to_table": "users",
        "to_column": "id",
        "constraint_name": "orders_ibfk_1"
      },
      {
        "from_table": "products",
        "from_column": "created_by",
        "to_table": "users",
        "to_column": "id",
        "constraint_name": "products_ibfk_2"
      }
    ],
    "external_references": [],
    "external_referenced": [
      {
        "from_table": "products",
        "from_column": "category_id",
        "to_table": "categories",
        "to_column": "id",
        "constraint_name": "products_ibfk_1"
      }
    ]
  },
  "summary": {
    "internal_connections_count": 2,
    "external_references_count": 0,
    "external_referenced_count": 1
  }
}
```

### Example 2: Find connections including order_items
**Prompt:** "Find all foreign key connections between products, orders, and order_items tables"

**Tool Call:**
```json
{
  "name": "find_table_connections",
  "arguments": {
    "table_names": ["products", "orders", "order_items"]
  }
}
```

**Expected Response:**
```json
{
  "requested_tables": ["products", "orders", "order_items"],
  "total_connections_found": 3,
  "connections": {
    "internal_connections": [
      {
        "from_table": "order_items",
        "from_column": "order_id",
        "to_table": "orders",
        "to_column": "id",
        "constraint_name": "order_items_ibfk_1"
      },
      {
        "from_table": "order_items",
        "from_column": "product_id",
        "to_table": "products",
        "to_column": "id",
        "constraint_name": "order_items_ibfk_2"
      }
    ],
    "external_references": [],
    "external_referenced": [
      {
        "from_table": "orders",
        "from_column": "user_id",
        "to_table": "users",
        "to_column": "id",
        "constraint_name": "orders_ibfk_1"
      }
    ]
  },
  "summary": {
    "internal_connections_count": 2,
    "external_references_count": 0,
    "external_referenced_count": 1
  }
}
```

## Use Cases

1. **Database Analysis**: Understand how tables are related in a complex database schema
2. **Migration Planning**: Identify dependencies when planning table modifications
3. **Data Integrity**: Verify foreign key relationships are properly established
4. **Documentation**: Generate relationship diagrams for database documentation
5. **Troubleshooting**: Identify missing or incorrect foreign key constraints

## Tool Features

- **Internal Connections**: Shows foreign keys between tables in the requested list
- **External References**: Shows foreign keys from external tables pointing to requested tables
- **External Referenced**: Shows foreign keys from requested tables pointing to external tables
- **Validation**: Automatically validates that all requested tables exist
- **Summary**: Provides counts of different types of connections found

## Error Handling

The tool handles various error scenarios:

- **Invalid table names**: Returns error if any requested table doesn't exist
- **Empty table list**: Returns error if no table names are provided
- **Database connection issues**: Returns appropriate error messages
- **Permission issues**: Returns error if user lacks permissions to query information_schema 