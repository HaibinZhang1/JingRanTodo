// sql.js 类型声明
declare module 'sql.js' {
    interface SqlJsStatic {
        Database: new (data?: ArrayLike<number> | Buffer | null) => Database
    }

    interface Database {
        run: (sql: string, params?: any[]) => void
        exec: (sql: string, params?: any[]) => QueryExecResult[]
        prepare: (sql: string) => Statement
        export: () => Uint8Array
        close: () => void
    }

    interface Statement {
        bind: (params?: any[]) => boolean
        step: () => boolean
        getAsObject: () => Record<string, any>
        run: (params?: any[]) => void
        free: () => void
    }

    interface QueryExecResult {
        columns: string[]
        values: any[][]
    }

    interface SqlJsConfig {
        locateFile?: (filename: string) => string
    }

    export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>
    export { Database, Statement, QueryExecResult, SqlJsStatic }
}
