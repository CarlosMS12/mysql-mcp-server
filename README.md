# MySQL MCP Server

Un servidor MCP (Model Context Protocol) para bases de datos MySQL con opciones de configuración flexibles.

[English](#english) | [Español](#español)

---

## Español

### Descripción

Este es un servidor MCP que permite conectar y consultar bases de datos MySQL desde cualquier cliente compatible con el protocolo MCP (como Claude Desktop, VS Code con Copilot, etc.). Ofrece configuración flexible mediante argumentos de línea de comandos, variables de entorno o archivos .env.

### Características

- 🔍 **Ejecución de consultas** - Ejecuta cualquier consulta SQL personalizada
- 📋 **Listado de tablas** - Lista todas las tablas de la base de datos
- 🏗️ **Estructura de tablas** - Describe esquemas y estructuras de tablas
- 🌐 **Configuración flexible** - Variables de entorno, archivos .env o argumentos de línea de comandos

### Instalación

#### Opción 1: NPX (Recomendada)
```bash
npx mysql-mcp-server-carlo --host localhost --port 3306 --user miusuario --password mipassword --database mibd
```

#### Opción 2: Instalación Global
```bash
npm install -g mysql-mcp-server-carlo
mysql-mcp-server-carlo --host localhost --port 3306 --user miusuario --password mipassword --database mibd
```

### Configuración

#### Argumentos de Línea de Comandos (Recomendado para distribución)
```bash
mysql-mcp-server-carlo --host HOST --port PUERTO --user USUARIO --password PASSWORD --database BASE_DE_DATOS
```

#### Variables de Entorno
```bash
export MYSQL_HOST=localhost
export MYSQL_PORT=3306
export MYSQL_USER=miusuario
export MYSQL_PASSWORD=mipassword
export MYSQL_DATABASE=mibd
mysql-mcp-server-carlo
```

#### Archivo .env (Solo para desarrollo)
Crear un archivo `.env`:
```
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=miusuario
MYSQL_PASSWORD=mipassword
MYSQL_DATABASE=mibd
```

### Configuración MCP

#### Claude Desktop
Agregar a tu archivo `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": [
        "mysql-mcp-server-carlo",
        "--host", "localhost",
        "--port", "3306",
        "--user", "tu_usuario",
        "--password", "tu_password",
        "--database", "tu_base_de_datos"
      ]
    }
  }
}
```

#### VS Code con Copilot
Agregar a tu configuración MCP:

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "npx",
      "args": [
        "mysql-mcp-server-carlo",
        "--host","localhost",
        "--port","3306",
        "--user","carlos",
        "--password","1234",
        "--database","test"
      ]
    }
  }
}
```

#### Otros Clientes MCP
Usar configuración similar con el comando y argumentos.

### Módulos Disponibles

#### 🔍 `query` - Ejecución de Consultas SQL
**Propósito**: Ejecutar cualquier consulta SQL personalizada (SELECT, INSERT, UPDATE, DELETE)
**Parámetros**:
- `sql` (string): La consulta SQL a ejecutar
- `params` (array, opcional): Parámetros para consultas preparadas

**Ejemplo de uso**:
```sql
SELECT * FROM productos WHERE precio > 100
INSERT INTO productos (nombre, precio, stock) VALUES ('Nuevo Producto', 99.99, 50)
```

#### 📋 `list_tables` - Listado de Tablas
**Propósito**: Obtener una lista de todas las tablas disponibles en la base de datos
**Parámetros**: Ninguno
**Uso**: Ideal para explorar la estructura de la base de datos y conocer qué tablas están disponibles

#### 🏗️ `describe_table` - Estructura de Tablas
**Propósito**: Obtener información detallada sobre la estructura de una tabla específica
**Parámetros**:
- `table_name` (string): Nombre de la tabla a describir

**Información que proporciona**:
- Nombres de columnas
- Tipos de datos
- Claves primarias y foráneas
- Valores por defecto
- Restricciones NULL/NOT NULL

### Seguridad

- ✅ Validación de entrada para nombres de tablas
- ✅ Consultas preparadas para prevenir inyección SQL
- ✅ Sanitización de parámetros
- ✅ Sin vulnerabilidades de inyección SQL

### Licencia

MIT

---

## English

### Description

This is an MCP server that allows connecting and querying MySQL databases from any MCP-compatible client (like Claude Desktop, VS Code with Copilot, etc.). It offers flexible configuration through command-line arguments, environment variables, or .env files.

### Features

- 🔍 **Query execution** - Run any custom SQL query
- 📋 **Table listing** - List all database tables
- 🏗️ **Table structure** - Describe table schemas and structures
- 🌐 **Flexible configuration** - Environment variables, .env files, or command-line arguments

### Installation

#### Option 1: NPX (Recommended)
```bash
npx mysql-mcp-server-carlo --host localhost --port 3306 --user myuser --password mypass --database mydb
```

#### Option 2: Global Installation
```bash
npm install -g mysql-mcp-server-carlo
mysql-mcp-server-carlo --host localhost --port 3306 --user myuser --password mypass --database mydb
```

### Configuration

#### Command Line Arguments (Recommended for distribution)
```bash
mysql-mcp-server-carlo --host HOST --port PORT --user USER --password PASSWORD --database DATABASE
```

#### Environment Variables
```bash
export MYSQL_HOST=localhost
export MYSQL_PORT=3306
export MYSQL_USER=myuser
export MYSQL_PASSWORD=mypass
export MYSQL_DATABASE=mydb
mysql-mcp-server-carlo
```

### Available Modules

#### 🔍 `query` - SQL Query Execution
**Purpose**: Execute any custom SQL query (SELECT, INSERT, UPDATE, DELETE)
**Parameters**:
- `sql` (string): The SQL query to execute
- `params` (array, optional): Parameters for prepared statements

#### 📋 `list_tables` - Table Listing
**Purpose**: Get a list of all available tables in the database
**Parameters**: None
**Usage**: Ideal for exploring database structure

#### 🏗️ `describe_table` - Table Structure
**Purpose**: Get detailed information about a specific table structure
**Parameters**:
- `table_name` (string): Name of the table to describe

### Security

- ✅ Input validation for table names
- ✅ Prepared statements to prevent SQL injection
- ✅ Parameter sanitization
- ✅ No SQL injection vulnerabilities

### License

MIT
