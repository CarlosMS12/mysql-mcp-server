#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as path from 'path';
import {fileURLToPath} from 'url';

// Obtener el directorio actual del archivo
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar el archivo .env desde el directorio raíz del proyecto (si existe)
const envPath = path.join(__dirname, '..', '.env');
console.error('Intentando cargar archivo .env desde:', envPath);
const result = dotenv.config({path: envPath});
if (result.error) {
	console.error(
		'No se encontró archivo .env, usando argumentos de línea de comandos o variables de entorno'
	);
} else {
	console.error('Archivo .env cargado exitosamente');
}

// Función para parsear argumentos de línea de comandos
function parseArgs() {
	const args = process.argv.slice(2);
	const config: any = {};

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
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import * as mysql from 'mysql2/promise';
import {z} from 'zod';

// Parsear argumentos de línea de comandos
const cmdArgs = parseArgs();

// Configuración de la base de datos (prioridad: argumentos > env > defaults)
const DB_CONFIG = {
	host: cmdArgs.host || process.env.MYSQL_HOST || 'localhost',
	port: cmdArgs.port || parseInt(process.env.MYSQL_PORT || '3306'),
	user: cmdArgs.user || process.env.MYSQL_USER || '',
	password: cmdArgs.password || process.env.MYSQL_PASSWORD || '',
	// No se define database aquí para permitir conexión global
	charset: 'utf8mb4',
};

// Validar que las credenciales requeridas estén presentes
if (!DB_CONFIG.user) {
	console.error('Error: Se requiere al menos el usuario de base de datos (user)');
	process.exit(1);
}

// Esquemas Zod para validación de entrada

class MySQLMCPServer {
	private server: McpServer;
	private connection: mysql.Connection | null = null;
	private activeDatabase: string | null = null;

	constructor() {
		this.server = new McpServer({
			name: 'mysql-mcp-server',
			version: '1.1.0',
		});
		this.activeDatabase = cmdArgs.database || process.env.MYSQL_DATABASE || null;
		this.setupToolsAndResources();
	}

	private async getConnection(): Promise<mysql.Connection> {
		if (!this.connection) {
			try {
				// Permitir agregar la propiedad database dinámicamente
				const config: any = {...DB_CONFIG};
				if (this.activeDatabase) config.database = this.activeDatabase;
				console.error('Intentando conectar a MySQL con configuración:', {
					host: config.host,
					port: config.port,
					user: config.user,
					database: this.activeDatabase || '(ninguna)',
					password: config.password ? '***' : 'NO DEFINIDO',
				});
				this.connection = await mysql.createConnection(config);
				if (this.activeDatabase) {
					await this.connection.query(`USE \`${this.activeDatabase}\``);
				}
				console.error('Conexión a MySQL establecida exitosamente');
			} catch (error) {
				console.error('Error al conectar a MySQL:', error);
				throw error;
			}
		}
		return this.connection;
	}

	private async reconnect(newDatabase: string | null = null) {
		if (this.connection) {
			await this.connection.end();
			this.connection = null;
		}
		this.activeDatabase = newDatabase;
	}

	private setupToolsAndResources() {
		// Herramienta: query
		this.server.tool(
			'query',
			'Ejecuta cualquier consulta SQL personalizada (SELECT, INSERT, UPDATE, DELETE)',
			{
				sql: z.string(),
				params: z.array(z.string()).optional(),
			},
			async ({sql, params}: {sql: string; params?: string[]}) => {
				try {
					const connection = await this.getConnection();
					const [results] = await connection.execute(sql, params || []);
					return {
						content: [{type: 'text', text: JSON.stringify(results, null, 2)}],
					};
				} catch (error) {
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
			}
		);

		// Herramienta: describe_table
		this.server.tool(
			'describe_table',
			'Obtiene información detallada sobre la estructura de una tabla específica',
			{table_name: z.string()},
			async ({table_name}: {table_name: string}) => {
				try {
					const connection = await this.getConnection();
					// Validar que el nombre de tabla solo contenga caracteres seguros
					if (!/^[a-zA-Z0-9_]+$/.test(table_name)) {
						throw new Error(
							'Nombre de tabla inválido. Solo se permiten letras, números y guiones bajos.'
						);
					}
					const [results] = await connection.execute(`DESCRIBE \`${table_name}\``);
					return {
						content: [{type: 'text', text: JSON.stringify(results, null, 2)}],
					};
				} catch (error) {
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
			}
		);

		// Herramienta: list_tables
		this.server.tool(
			'list_tables',
			'Lista todas las tablas disponibles en la base de datos',
			{},
			async () => {
				try {
					const connection = await this.getConnection();
					const [results] = await connection.execute('SHOW TABLES');
					return {
						content: [{type: 'text', text: JSON.stringify(results, null, 2)}],
					};
				} catch (error) {
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
			}
		);

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

		// Herramienta: list_databases
		this.server.tool(
			'list_databases',
			'Lista todas las bases de datos disponibles en el servidor',
			{},
			async () => {
				try {
					const connection = await this.getConnection();
					const [results] = await connection.query('SHOW DATABASES');
					return {
						content: [{type: 'text', text: JSON.stringify(results, null, 2)}],
					};
				} catch (error) {
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
			}
		);

		// Herramienta: create_database
		this.server.tool(
			'create_database',
			'Crea una nueva base de datos',
			{database_name: z.string()},
			async ({database_name}: {database_name: string}) => {
				if (!/^[a-zA-Z0-9_]+$/.test(database_name)) {
					return {
						content: [
							{
								type: 'text',
								text:
									'Nombre de base de datos inválido. Solo se permiten letras, números y guiones bajos.',
							},
						],
						isError: true,
					};
				}
				try {
					const connection = await this.getConnection();
					await connection.query(`CREATE DATABASE \`${database_name}\``);
					return {
						content: [
							{type: 'text', text: `Base de datos '${database_name}' creada exitosamente.`},
						],
					};
				} catch (error) {
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
			}
		);

		// Herramienta: use_database
		this.server.tool(
			'use_database',
			'Cambia la base de datos activa para la sesión',
			{database_name: z.string()},
			async ({database_name}: {database_name: string}) => {
				if (!/^[a-zA-Z0-9_]+$/.test(database_name)) {
					return {
						content: [
							{
								type: 'text',
								text:
									'Nombre de base de datos inválido. Solo se permiten letras, números y guiones bajos.',
							},
						],
						isError: true,
					};
				}
				try {
					await this.reconnect(database_name);
					await this.getConnection();
					return {
						content: [
							{type: 'text', text: `Base de datos activa cambiada a '${database_name}'.`},
						],
					};
				} catch (error) {
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
			}
		);
	}

	private async getFullSchema() {
		const connection = await this.getConnection();

		// Obtener todas las tablas
		const [tables] = await connection.execute(
			`SELECT TABLE_NAME, TABLE_COMMENT 
       FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = DATABASE()`
		);

		const schema: any = {tables: {}};

		for (const table of tables as any[]) {
			const tableName = table.TABLE_NAME;

			// Obtener columnas
			const [columns] = await connection.execute(
				`SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
         FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
				[tableName]
			);

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
