import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { USER_REFERENCES } from '../dao/userReferences.js';

interface Table {
    columns: string[];
    uniqueKeys: string[][];
    userForeignKeys: string[];
}

const schema: string = readFileSync(new URL('../dao/schema.sql', import.meta.url), 'utf8');

const tables: Map<string, Table> = new Map(
    [...schema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\)/g)].map(([, name, body]) => [name, {
        columns: [...body.matchAll(/^\s+(\w+)\s+(?:BIGINT|INT|VARCHAR|TEXT|LONGBLOB|TINYINT|DATETIME|ENUM)/gm)].map(([, column]) => column),
        uniqueKeys: [...body.matchAll(/(?:PRIMARY KEY|UNIQUE KEY \w+) \(([^)]*)\)/g)].map(([, columns]) => columns.split(',').map(c => c.trim())),
        userForeignKeys: [...body.matchAll(/FOREIGN KEY \((\w+)\)\s+REFERENCES user \(id\)/g)].map(([, column]) => column)
    }])
);

const referenced = (table: string, column: string): boolean =>
    USER_REFERENCES.some(ref => ref.table === table && ref.column === column);

test('the schema was parsed', () => {
    assert.ok(tables.has('user'));
    assert.deepEqual(tables.get('user_steam_id'), {
        columns: ['user_id', 'steam_id'],
        uniqueKeys: [['user_id', 'steam_id']],
        userForeignKeys: ['user_id']
    });
});

test('every foreign key into user is merged', () => {
    tables.forEach((table, name) => table.userForeignKeys.forEach(column => {
        assert.ok(referenced(name, column), `${name}.${column} references user but is not in USER_REFERENCES`);
    }));
});

test('every column holding a user id is merged, foreign key or not', () => {
    tables.forEach((table, name) => table.columns.filter(column => name !== 'user' && column.endsWith('user_id')).forEach(column => {
        assert.ok(referenced(name, column), `${name}.${column} holds a user id but is not in USER_REFERENCES`);
    }));
});

test('every reference names a real table and columns', () => {
    USER_REFERENCES.forEach(ref => {
        const table: Table | undefined = tables.get(ref.table);
        assert.ok(table, `${ref.table} is not in the schema`);
        [ref.column, ...(ref.duplicateKey ?? []), ...(ref.nameColumn ? [ref.nameColumn] : [])].forEach(column => {
            assert.ok(table.columns.includes(column), `${ref.table}.${column} is not in the schema`);
        });
    });
});

test('a unique key containing the user column is deduplicated on its other columns', () => {
    USER_REFERENCES.forEach(ref => {
        tables.get(ref.table)!.uniqueKeys.filter(key => key.includes(ref.column)).forEach(key => {
            assert.deepEqual(
                [...(ref.duplicateKey ?? ['<none>'])].sort(),
                key.filter(column => column !== ref.column).sort(),
                `${ref.table} is unique on (${key.join(', ')}) so merging must deduplicate on the other columns`
            );
        });
    });
});
