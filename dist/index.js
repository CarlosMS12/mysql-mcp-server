#!/usr/bin/env node
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
// Obtener el directorio actual del archivo
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Cargar el archivo .env desde el directorio raíz del proyecto (si existe)
const envPath = path.join(__dirname, '..', '.env');
console.error('Intentando cargar archivo .env desde:', envPath);
const result = dotenv.config({ path: envPath });
if (result.error) {
    console.error('No se encontró archivo .env, usando argumentos de línea de comandos o variables de entorno');
}
else {
    console.error('Archivo .env cargado exitosamente');
}
// Función para parsear argumentos de línea de comandos
function parseArgs() {
    const args = process.argv.slice(2);
    const config = {};
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i];
        const value = args[i + 1];
        switch (key) {
            case '--host':
                config.host = value;
                break;
            case '--port':
                config.port = parseInt(value);
                break;
            case '--user':
                config.user = value;
                break;
            case '--password':
                config.password = value;
                break;
            case '--database':
                config.database = value;
                break;
        }
    }
    return config;
}
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as mysql from 'mysql2/promise';
import { z } from 'zod';
// Parsear argumentos de línea de comandos
const cmdArgs = parseArgs();
// Configuración de la base de datos (prioridad: argumentos > env > defaults)
const DB_CONFIG = {
    host: cmdArgs.host || process.env.MYSQL_HOST || 'localhost',
    port: cmdArgs.port || parseInt(process.env.MYSQL_PORT || '3306'),
    user: cmdArgs.user || process.env.MYSQL_USER || '',
    password: cmdArgs.password || process.env.MYSQL_PASSWORD || '',
    database: cmdArgs.database || process.env.MYSQL_DATABASE || '',
    charset: 'utf8mb4',
};
// Validar que las credenciales requeridas estén presentes
if (!DB_CONFIG.user || !DB_CONFIG.password || !DB_CONFIG.database) {
    console.error('Error: Se requieren credenciales de base de datos');
    console.error('Puedes proporcionarlas de 3 formas:');
    console.error('1. Variables de entorno: MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE');
    console.error('2. Archivo .env en el directorio del proyecto');
    console.error('3. Argumentos de línea de comandos: --host --port --user --password --database');
    console.error('');
    console.error('Ejemplo de uso con argumentos:');
    console.error('npx mysql-mcp-server-carlo --host localhost --port 3306 --user carlos --password 1234 --database test');
    console.error('');
    console.error('Configuración actual:');
    console.error('HOST:', DB_CONFIG.host);
    console.error('PORT:', DB_CONFIG.port);
    console.error('USER:', DB_CONFIG.user || 'NO DEFINIDO');
    console.error('PASSWORD:', DB_CONFIG.password ? '***' : 'NO DEFINIDO');
    console.error('DATABASE:', DB_CONFIG.database || 'NO DEFINIDO');
    process.exit(1);
}
// Esquemas Zod para validación de entrada
class MySQLMCPServer {
    server;
    connection = null;
    constructor() {
        this.server = new McpServer({
            name: 'mysql-mcp-server',
            version: '1.0.0',
        });
        this.setupToolsAndResources();
    }
    async getConnection() {
        if (!this.connection) {
            try {
                console.error('Intentando conectar a MySQL con configuración:', {
                    host: DB_CONFIG.host,
                    port: DB_CONFIG.port,
                    user: DB_CONFIG.user,
                    database: DB_CONFIG.database,
                    password: DB_CONFIG.password ? '***' : 'NO DEFINIDO'
                });
                this.connection = await mysql.createConnection(DB_CONFIG);
                console.error('Conexión a MySQL establecida exitosamente');
            }
            catch (error) {
                console.error('Error al conectar a MySQL:', error);
                throw error;
            }
        }
        return this.connection;
    }
    setupToolsAndResources() {
        // Herramienta: query
        this.server.tool('query', 'Ejecuta cualquier consulta SQL personalizada (SELECT, INSERT, UPDATE, DELETE)', {
            sql: z.string(),
            params: z.array(z.string()).optional(),
        }, async ({ sql, params }) => {
            try {
                const connection = await this.getConnection();
                const [results] = await connection.execute(sql, params || []);
                return {
                    content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
        // Herramienta: describe_table
        this.server.tool('describe_table', 'Obtiene información detallada sobre la estructura de una tabla específica', { table_name: z.string() }, async ({ table_name }) => {
            try {
                const connection = await this.getConnection();
                // Validar que el nombre de tabla solo contenga caracteres seguros
                if (!/^[a-zA-Z0-9_]+$/.test(table_name)) {
                    throw new Error('Nombre de tabla inválido. Solo se permiten letras, números y guiones bajos.');
                }
                const [results] = await connection.execute(`DESCRIBE \`${table_name}\``);
                return {
                    content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
        // Herramienta: list_tables
        this.server.tool('list_tables', 'Lista todas las tablas disponibles en la base de datos', {}, async () => {
            try {
                const connection = await this.getConnection();
                const [results] = await connection.execute('SHOW TABLES');
                return {
                    content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
        // Recurso: esquema de la base de datos
        this.server.resource('esquema', 'mysql://schema', async () => {
            const schema = await this.getFullSchema();
            return {
                contents: [
                    {
                        uri: 'mysql://schema',
                        mimeType: 'application/json',
                        text: JSON.stringify(schema, null, 2),
                    },
                ],
            };
        });
    }
    async getFullSchema() {
        const connection = await this.getConnection();
        // Obtener todas las tablas
        const [tables] = await connection.execute(`SELECT TABLE_NAME, TABLE_COMMENT 
       FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = DATABASE()`);
        const schema = { tables: {} };
        for (const table of tables) {
            const tableName = table.TABLE_NAME;
            // Obtener columnas
            const [columns] = await connection.execute(`SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
         FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [tableName]);
            // Obtener índices
            // Validar nombre de tabla para seguridad
            if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
                continue; // Saltar tablas con nombres inválidos
            }
            const [indexes] = await connection.execute(`SHOW INDEX FROM \`${tableName}\``);
            schema.tables[tableName] = {
                comment: table.TABLE_COMMENT,
                columns,
                indexes,
            };
        }
        return schema;
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Servidor MCP MySQL iniciado');
    }
}
// Iniciar el servidor
const server = new MySQLMCPServer();
server.run().catch(console.error);
