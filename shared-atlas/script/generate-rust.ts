import { Project, ClassDeclaration, InterfaceDeclaration, EnumDeclaration, Type, Node } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

const SHARED_ATLAS_PATH = path.join(__dirname, '../src');
const OUTPUT_DIR = path.join(__dirname, '../../shared-atlas-rust');
const SRC_DIR = path.join(OUTPUT_DIR, 'src');

// Ensure output directories exist
if (!fs.existsSync(SRC_DIR)) {
    fs.mkdirSync(SRC_DIR, { recursive: true });
}

// Initialize ts-morph project
const project = new Project({
    tsConfigFilePath: path.join(__dirname, '../tsconfig.json'),
});

// Helper to convert PascalCase to snake_case for filenames/modules
function toSnakeCase(str: string): string {
    return str
        .replace(/\.?([A-Z]+)/g, (x, y) => '_' + y.toLowerCase())
        .replace(/^_/, '');
}

// Helper to convert SCREAMING_SNAKE_CASE or snake_case to PascalCase
function toPascalCase(str: string): string {
    return str.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}

// Helper: Map TypeScript types to Rust types
function mapTypeToRust(type: Type, isOptional: boolean): string {
    let rustType = 'serde_json::Value'; // Default to dynamic JSON value
    const text = type.getText();

    if (type.isString() || type.isStringLiteral()) {
        rustType = 'String';
    } else if (type.isNumber() || type.isNumberLiteral()) {
        rustType = 'f64'; // Default to float for JS numbers
    } else if (type.isBoolean() || type.isBooleanLiteral()) {
        rustType = 'bool';
    } else if (type.isArray()) {
        const elementType = type.getArrayElementType();
        if (elementType) {
            rustType = `Vec<${mapTypeToRust(elementType, false)}>`;
        } else {
            rustType = 'Vec<serde_json::Value>';
        }
    } else if (text === 'Date') {
        rustType = 'chrono::DateTime<chrono::Utc>';
    } else if (type.isClass() || type.isInterface()) {
        const symbol = type.getSymbol();
        if (symbol) {
            rustType = symbol.getName();
        }
    } else if (type.isEnum()) {
        const symbol = type.getSymbol();
        if (symbol) {
            rustType = symbol.getName();
        }
    }

    // Handle nullable/optional
    if (isOptional || type.isNullable()) {
        if (rustType === 'serde_json::Value') return 'Option<serde_json::Value>';
        return `Option<${rustType}>`;
    }
    return rustType;
}

// Helper: Extract and format JSDoc comment
function extractJsDoc(node: any): string[] {
    const lines: string[] = [];
    const jsDocs = node.getJsDocs();
    if (jsDocs && jsDocs.length > 0) {
        const doc = jsDocs[0];
        const description = doc.getDescription().trim();
        if (description) {
            const descLines = description.split('\n');
            descLines.forEach(line => {
                lines.push(`/// ${line.trim()}`);
            });
        }
    }
    return lines;
}

// Generate Rust Enum
function generateRustEnum(enumDec: EnumDeclaration): string {
    const enumName = enumDec.getName();
    if (!enumName) return '';

    const lines: string[] = [];

    // Add JSDoc
    const jsDoc = extractJsDoc(enumDec);
    if (jsDoc.length > 0) lines.push(...jsDoc);

    lines.push(`#[derive(Debug, Clone, Serialize, Deserialize)]`);
    lines.push(`pub enum ${enumName} {`);

    const members = enumDec.getMembers();
    members.forEach(member => {
        const originalName = member.getName();
        const rustName = toPascalCase(originalName);

        const initializer = member.getInitializer();
        let serializeName = originalName;

        if (initializer) {
            const initText = initializer.getText().replace(/^['"]|['"]$/g, '');
            serializeName = initText;
        }

        // Always add serde rename to preserve JSON compatibility
        lines.push(`    #[serde(rename = "${serializeName}")]`);
        lines.push(`    ${rustName},`);
    });

    lines.push(`}`);
    return lines.join('\n');
}

// Generate Rust Struct from Class/Interface
function generateRustStruct(classDec: ClassDeclaration | InterfaceDeclaration): string {
    const className = classDec.getName();
    if (!className) return '';

    const lines: string[] = [];

    // Add JSDoc
    const jsDoc = extractJsDoc(classDec);
    if (jsDoc.length > 0) lines.push(...jsDoc);

    lines.push(`#[derive(Debug, Clone, Serialize, Deserialize)]`);
    lines.push(`#[serde(rename_all = "camelCase")]`); // Default TS is camelCase
    lines.push(`pub struct ${className} {`);

    // Get all properties
    const type = classDec.getType();
    const props = type.getProperties();

    if (props.length === 0) {
        // Empty struct
        lines.push(`}`);
        return lines.join('\n');
    }

    for (const propSymbol of props) {
        const decls = propSymbol.getDeclarations();
        if (!decls || decls.length === 0) continue;
        const propDecl = decls[0];

        // Skip methods
        if (Node.isMethodDeclaration(propDecl) || Node.isMethodSignature(propDecl)) continue;

        let name = propSymbol.getName();
        const originalName = name.replace(/^['"]|['"]$/g, '');

        // Sanitize name for Rust (snake_case)
        const sanitized = originalName.replace(/[^a-zA-Z0-9]/g, '_');
        let rustName = toSnakeCase(sanitized);

        if (['type', 'struct', 'enum', 'match', 'impl', 'trait', 'fn', 'let', 'pub', 'mod', 'use', 'crate', 'super', 'self', 'Self', 'where', 'for', 'loop', 'while', 'if', 'else', 'break', 'continue', 'return', 'in', 'as', 'const', 'static', 'unsafe', 'extern', 'ref', 'mut', 'move'].includes(rustName)) {
            rustName = `r#${rustName}`;
        }

        const propJsDoc = extractJsDoc(propDecl);
        if (propJsDoc.length > 0) lines.push(...propJsDoc);

        // Determine type
        const propType = propDecl.getType();
        let isOptional = propSymbol.isOptional();

        if (Node.isPropertyDeclaration(propDecl)) {
            if (propDecl.hasQuestionToken()) isOptional = true;
            // Check decorators for IsOptional
            const decorators = propDecl.getDecorators().map(d => d.getName());
            if (decorators.includes('IsOptional')) isOptional = true;
        } else if (Node.isPropertySignature(propDecl)) {
            if (propDecl.hasQuestionToken()) isOptional = true;
        }

        let rustType = mapTypeToRust(propType, isOptional);

        // Int override
        if (rustType.includes('f64') && Node.isPropertyDeclaration(propDecl)) {
            const decorators = propDecl.getDecorators().map(d => d.getName());
            if (decorators.includes('IsInt')) {
                rustType = rustType.replace('f64', 'i32');
            }
        }

        // Rename field if needed
        if (/[^a-zA-Z0-9]/.test(originalName)) {
            lines.push(`    #[serde(rename = "${originalName}")]`);
        }

        lines.push(`    pub ${rustName}: ${rustType},`);
    }

    lines.push(`}`);
    return lines.join('\n');
}

async function main() {
    console.log('Generating Rust models...');

    const patterns = [
        path.join(SHARED_ATLAS_PATH, 'dto/*.ts'),
        path.join(SHARED_ATLAS_PATH, 'interfaces/*.ts'),
        path.join(SHARED_ATLAS_PATH, 'constants/*.ts'),
    ];
    console.log('Searching in patterns:', patterns);

    const sourceFiles = project.addSourceFilesAtPaths(patterns);
    console.log(`Found ${sourceFiles.length} source files.`);

    const generatedFiles: string[] = [];

    // Helper to save file
    function saveFile(name: string, content: string, subDir: string) {
        const targetDir = path.join(SRC_DIR, subDir);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const fileName = toSnakeCase(name) + ".rs";
        const filePath = path.join(targetDir, fileName);

        // Add use statements
        const uses = [
            'use serde::{Serialize, Deserialize};',
        ];
        // If content has DateTime, add chrono
        if (content.includes('DateTime<Utc>')) {
            uses.push('use chrono::{DateTime, Utc};');
        }
        // If content has serde_json::Value
        if (content.includes('serde_json::Value')) {
            uses.push('use serde_json;');
        }

        // Add imports for other generated types (naively import everything from sibling/crate root?)
        // Rust modules are strict. 
        // Simpler approach: Put all models in `src/model/mod.rs` or `src/model/*.rs` and re-export.
        // We will output everything flat or mirror structure?
        // Let's mirror structure: src/dto/foo.rs, src/interfaces/bar.rs
        // But they might reference each other.
        // To make it easy, we can use `crate::model::*` if we put everything under model.
        // Or better: `use super::*;` if in same model?

        // Let's flatten everything into `src/model` for simplicity in Rust if possible?
        // TS has naming conflicts? Maybe.
        // Let's stick strictly to directory structure. 
        // References: if A uses B, and B is in another module, A needs `use crate::path::to::B;`

        // To simplify, we will assume all generated types are unique and re-export them all from `lib.rs` -> `prelude`?
        // Or we just add `use crate::*`? 

        // Let's try to add imports for known types.
        // We can't easily know where everything is without a second pass or a map.

        // Let's do a map of TypeName -> Path

        const fullContent = uses.join('\n') + '\n\n' + content;
        fs.writeFileSync(filePath, fullContent);
        console.log(`Generated ${fileName}`);
    }

    // Pass 1: Collect type locations
    const typeLocation = new Map<string, string>(); // Type -> "dto/file_name" (no ext)

    for (const sourceFile of sourceFiles) {
        const sourcePath = sourceFile.getFilePath();
        const relativePath = path.relative(SHARED_ATLAS_PATH, sourcePath);
        const relativeDir = path.dirname(relativePath); // "dto" or "interfaces"

        for (const cls of sourceFile.getClasses()) {
            if (cls.isExported()) typeLocation.set(cls.getName()!, path.join(relativeDir, toSnakeCase(cls.getName()!)));
        }
        for (const iface of sourceFile.getInterfaces()) {
            if (iface.isExported()) typeLocation.set(iface.getName()!, path.join(relativeDir, toSnakeCase(iface.getName()!)));
        }
        for (const enm of sourceFile.getEnums()) {
            if (enm.isExported()) typeLocation.set(enm.getName()!, path.join(relativeDir, toSnakeCase(enm.getName()!)));
        }
    }

    // Pass 2: Generate
    const modules = new Map<string, string[]>(); // relativeDir -> [mod names]

    for (const sourceFile of sourceFiles) {
        const sourcePath = sourceFile.getFilePath();
        const relativePath = path.relative(SHARED_ATLAS_PATH, sourcePath);
        const relativeDir = path.dirname(relativePath);

        const fileContent: string[] = [];

        for (const cls of sourceFile.getClasses()) {
            if (cls.isExported()) fileContent.push(generateRustStruct(cls));
        }
        for (const iface of sourceFile.getInterfaces()) {
            if (iface.isExported()) fileContent.push(generateRustStruct(iface));
        }
        for (const enm of sourceFile.getEnums()) {
            if (enm.isExported()) fileContent.push(generateRustEnum(enm));
        }

        if (fileContent.length === 0) continue;

        // Determine imports for this file
        // Naive: check if any known type is mentioned in valid symbols
        let imports = new Set<string>();
        const contentStr = fileContent.join('\n');

        typeLocation.forEach((loc, typeName) => {
            // Primitive check: matches word boundary
            const regex = new RegExp(`\\b${typeName}\\b`);
            if (regex.test(contentStr) && !contentStr.includes(`enum ${typeName}`) && !contentStr.includes(`struct ${typeName}`)) {
                // It is used and not defined here (mostly)
                // Actually if multiple types in same file, we need careful check.
                // But we are splitting by file? No, we are splitting by source file.

                // If defined in THIS source file, no import needed.
                // But we are writing 1 file per type? 
                // Wait, generate-dart did: saveFileWithStructure(sourceFile, className, dartCode); => 1 file per Class/Enum.
                // Rust prefers that too strictly? No, Rust like modules.

                // Let's stick to 1 file per Class/Enum to match Dart logic and keep it simple.
            }
        });

        // Re-do loop for 1-file-per-type
        const typesInFile = [
            ...sourceFile.getClasses().filter(c => c.isExported()).map(c => ({ node: c, type: 'class', name: c.getName()! })),
            ...sourceFile.getInterfaces().filter(i => i.isExported()).map(i => ({ node: i, type: 'interface', name: i.getName()! })),
            ...sourceFile.getEnums().filter(e => e.isExported()).map(e => ({ node: e, type: 'enum', name: e.getName()! }))
        ];

        for (const item of typesInFile) {
            let code = '';
            if (item.type === 'class' || item.type === 'interface') code = generateRustStruct(item.node as any);
            else code = generateRustEnum(item.node as EnumDeclaration);

            if (!code) continue;

            const name = item.name;
            const snakeName = toSnakeCase(name);
            const targetDir = path.join(SRC_DIR, relativeDir);
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

            // Calculate Imports
            const requiredImports = new Set<string>();

            // For enums, usually don't need to import other types
            // Only structs/interfaces may reference other types
            if (item.type !== 'enum') {
                typeLocation.forEach((loc, typeName) => {
                    if (typeName === name) return; // Self
                    const regex = new RegExp(`\\b${typeName}\\b`);
                    if (regex.test(code)) {
                        // Need to import
                        // loc is "dto/chat_dto"
                        // We are in relativeDir (e.g. "dto")
                        // crate path: crate::dto::chat_dto::ChatDto

                        // Construct crate path
                        // We need to map dir to module path.
                        const modPath = loc.replace(/[\\/]/g, '::');
                        requiredImports.add(`use crate::${modPath}::${typeName};`);
                    }
                });
            }

            const importsList = [
                'use serde::{Serialize, Deserialize};',
                ...Array.from(requiredImports)
            ];
            if (code.includes('DateTime<Utc>')) importsList.push('use chrono::{DateTime, Utc};');
            if (code.includes('serde_json::Value')) importsList.push('use serde_json;');


            const fileOut = importsList.join('\n') + '\n\n' + code;
            fs.writeFileSync(path.join(targetDir, snakeName + '.rs'), fileOut);

            // Track for mod.rs
            if (!modules.has(relativeDir)) modules.set(relativeDir, []);
            modules.get(relativeDir)!.push(snakeName);
        }
    }

    // Generate mod.rs files
    modules.forEach((modNames, dir) => {
        const modContent = modNames.map(n => `pub mod ${n};`).join('\n');
        fs.writeFileSync(path.join(SRC_DIR, dir, 'mod.rs'), modContent);
    });

    // Generate lib.rs (or main mod) imports
    // We assume top level dirs (dto, interfaces) need to be in lib.rs
    const topDirs = new Set<string>(modules.keys());
    const libContent: string[] = [];
    topDirs.forEach(d => {
        // d is like "dto" or "interfaces"
        // If it's nested "foo/bar" -> structure "foo" mod.rs?
        // simple support for 1 level nesting for now as per shared-atlas

        // Actually shared-atlas has "dto" and "interfaces" at root of src.
        // So d is "dto".
        libContent.push(`pub mod ${d};`);
    });

    fs.writeFileSync(path.join(SRC_DIR, 'lib.rs'), libContent.join('\n'));
    console.log('Done.');

    // Update Cargo.toml version
    try {
        const packageJsonPath = path.join(__dirname, '../package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const baseVersion = packageJson.version || '0.0.1';

        // Use Seconds since 2025-01-01 Base36 for short unique (approx 5 chars)
        // 1735689600000 is 2025-01-01
        const epoch = 1735689600000;
        const seconds = Math.floor((Date.now() - epoch) / 1000);
        const suffix = seconds.toString(36);

        const rustVersion = `${baseVersion}-${suffix}`;

        const cargoTomlPath = path.join(OUTPUT_DIR, 'Cargo.toml');
        if (fs.existsSync(cargoTomlPath)) {
            let cargoToml = fs.readFileSync(cargoTomlPath, 'utf-8');
            // Regex to replace version in [package] section
            // Assumes version is one of the first keys before [dependencies]
            // We use a safe regex that matches `version = "..."` at the start of a line
            cargoToml = cargoToml.replace(/^version\s*=\s*".*"/m, `version = "${rustVersion}"`);

            fs.writeFileSync(cargoTomlPath, cargoToml);
            console.log(`Updated Cargo.toml version to ${rustVersion}`);
        }
    } catch (e) {
        console.error('Failed to update Cargo.toml version:', e);
    }
}

main().catch(console.error);
