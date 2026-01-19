import { Project, SyntaxKind, ClassDeclaration, InterfaceDeclaration, EnumDeclaration, Type, Symbol as MorphSymbol, Node } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

const SHARED_ATLAS_PATH = path.join(__dirname, '../src');
const OUTPUT_DIR = path.join(__dirname, '../../shared-atlas-dart');
const LIB_DIR = path.join(OUTPUT_DIR, 'lib');

// Ensure output directories exist
if (!fs.existsSync(LIB_DIR)) {
    fs.mkdirSync(LIB_DIR, { recursive: true });
}

// Initialize ts-morph project
const project = new Project({
    tsConfigFilePath: path.join(__dirname, '../tsconfig.json'),
});

// Helper to convert PascalCase to snake_case for filenames
function toSnakeCase(str: string): string {
    return str
        .replace(/\.?([A-Z]+)/g, (x, y) => '_' + y.toLowerCase())
        .replace(/^_/, '');
}

// Helper: Map TypeScript types to Dart types
function mapTypeToDart(type: Type, isOptional: boolean): string {
    let dartType = 'dynamic';
    const text = type.getText();

    if (type.isString() || type.isStringLiteral()) {
        dartType = 'String';
    } else if (type.isNumber() || type.isNumberLiteral()) {
        // Default to num, but could check for @IsInt later if needed
        dartType = 'num';
    } else if (type.isBoolean() || type.isBooleanLiteral()) {
        dartType = 'bool';
    } else if (type.isArray()) {
        const elementType = type.getArrayElementType();
        if (elementType) {
            dartType = `List<${mapTypeToDart(elementType, false)}>`;
        } else {
            dartType = 'List<dynamic>';
        }
    } else if (text === 'Date') {
        dartType = 'DateTime';
    } else if (type.isClass() || type.isInterface()) {
        // If it's a custom class/interface, use its name
        const symbol = type.getSymbol();
        if (symbol) {
            dartType = symbol.getName();
        }
    } else if (type.isEnum()) {
        const symbol = type.getSymbol();
        if (symbol) {
            dartType = symbol.getName();
        }
    }

    // Handle nullable/optional
    if (isOptional || type.isNullable()) {
        if (dartType === 'dynamic') return 'dynamic';
        return `${dartType}?`;
    }
    return dartType;
}

// Helper: Extract and format JSDoc comment from ts-morph node
function extractJsDoc(node: any): string[] {
    const lines: string[] = [];
    const jsDocs = node.getJsDocs();
    if (jsDocs && jsDocs.length > 0) {
        const doc = jsDocs[0];
        const description = doc.getDescription().trim();
        if (description) {
            // Convert JSDoc to Dart doc comment (///)
            const descLines = description.split('\n');
            descLines.forEach(line => {
                lines.push(`/// ${line.trim()}`);
            });
        }
    }
    return lines;
}


// Helper: Generate random build suffix (4 alphanumeric characters)
function generateBuildSuffix(): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Helper: Get Dart default value
function getDartDefaultValue(type: Type): string | null {
    if (type.isArray()) return '[]';
    return null;
}

// Generate Dart Enum
function generateDartEnum(enumDec: EnumDeclaration): string {
    const enumName = enumDec.getName();
    if (!enumName) return '';

    const lines: string[] = [];

    // Add JSDoc comment if available
    const jsDoc = extractJsDoc(enumDec);
    if (jsDoc.length > 0) {
        lines.push(...jsDoc);
    }

    // Enums don't reference other generated types, so no import needed
    lines.push(`enum ${enumName} {`);

    const members = enumDec.getMembers();
    members.forEach(member => {
        let value = member.getName(); // Default to name
        const initializer = member.getInitializer();
        if (initializer) {
            // Remove quotes if string
            value = initializer.getText().replace(/^['"]|['"]$/g, '');
        }
        lines.push(`  // @JsonValue('${value}')`); // Annotation removed to avoid dependency
        lines.push(`  ${member.getName()}('${value}'),`);
    });
    // End of enum constants
    lines[lines.length - 1] = lines[lines.length - 1].replace(',', ';');

    lines.push('');
    lines.push(`  final String value;`);
    lines.push(`  const ${enumName}(this.value);`);
    lines.push('');
    lines.push(`  factory ${enumName}.fromJson(dynamic json) {`);
    lines.push(`    return ${enumName}.values.firstWhere((e) => e.value == json.toString(), orElse: () => ${enumName}.values.first);`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  String toJson() => value;`);
    lines.push(`}`);

    return lines.join('\n');
}

// Generate Dart Class
function generateDartClass(classDec: ClassDeclaration | InterfaceDeclaration, knownEnums: Set<string>): string {
    const className = classDec.getName();
    if (!className) return '';

    const properties: { name: string; originalName: string; type: string; isOptional: boolean; jsDoc: string[]; defaultValue?: string }[] = [];

    // Get all properties (flattened inheritance)
    const type = classDec.getType();
    const props = type.getProperties();

    for (const propSymbol of props) {
        const decls = propSymbol.getDeclarations();
        if (!decls || decls.length === 0) continue;

        const propDecl = decls[0]; // Use the first declaration

        // Skip methods
        if (Node.isMethodDeclaration(propDecl) || Node.isMethodSignature(propDecl)) continue;

        let name = propSymbol.getName();
        const originalName = name.replace(/^['"]|['"]$/g, '');

        // Sanitize name for Dart
        name = originalName.replace(/[^a-zA-Z0-9$]/g, '_');
        // Handle reserved keywords
        if (['in', 'is', 'var', 'final', 'const', 'class', 'enum', 'default', 'extends', 'with', 'implements'].includes(name)) {
            name = name + '_';
        }

        // Extract JSDoc for this property
        const propJsDoc = extractJsDoc(propDecl);

        // Determine type
        // Use getTypeAtLocation logic if possible, or just getType() from declaration
        const propType = propDecl.getType();

        let isOptional = false;
        // Check optionality from symbol or declaration
        if (propSymbol.isOptional()) {
            isOptional = true;
        } else if (Node.isPropertyDeclaration(propDecl) || Node.isPropertySignature(propDecl)) {
            if (propDecl.hasQuestionToken()) isOptional = true;
        }

        // Check decorators (only exist on Class Properties)
        if (Node.isPropertyDeclaration(propDecl)) {
            const decorators = propDecl.getDecorators().map(d => d.getName());
            if (decorators.includes('IsOptional')) {
                isOptional = true;
            }
        }

        let dartType = mapTypeToDart(propType, isOptional);

        // Special override for Int using decorators
        if (dartType.startsWith('num') && Node.isPropertyDeclaration(propDecl)) {
            const decorators = propDecl.getDecorators().map(d => d.getName());
            if (decorators.includes('IsInt')) {
                dartType = dartType.replace('num', 'int');
            }
            if (decorators.includes('IsNumber')) {
                dartType = dartType.replace('num', 'double');
            }
        }

        properties.push({ name, originalName, type: dartType, isOptional, jsDoc: propJsDoc });
    }

    // If no properties, skip generation (e.g. for Services or empty marker interfaces)
    // Exception: Explicitly empty DTOs might be needed? 
    // Let's Skip for now to avoid syntax errors and useless files.
    if (properties.length === 0) {
        console.log(`Skipping ${className} (no properties found)`);
        return '';
    }

    // Check if any property references a generated type (Enum or Class)
    const needsImport = properties.some(p => {
        const cleanType = p.type.replace(/[?\[\]<>]/g, ' ').split(' ').filter(t => t.trim());
        return cleanType.some(t => {
            // Check if it's a known enum or a non-primitive type
            if (knownEnums.has(t)) return true;
            if (!['String', 'int', 'double', 'num', 'bool', 'dynamic', 'DateTime', 'List', 'Map'].includes(t)) {
                return true; // Custom class type
            }
            return false;
        });
    });

    const lines: string[] = [];
    // Add package import only if needed
    if (needsImport) {
        lines.push(`import 'package:shared_atlas_dart/shared_atlas_dart.dart';`);
        lines.push('');
    }

    // Add class-level JSDoc
    const classJsDoc = extractJsDoc(classDec);
    if (classJsDoc.length > 0) {
        lines.push(...classJsDoc);
    }

    lines.push(`class ${className} {`);

    // Properties
    properties.forEach(p => {
        // Add property JSDoc if available
        if (p.jsDoc.length > 0) {
            p.jsDoc.forEach(doc => lines.push(`  ${doc}`));
        }
        lines.push(`  final ${p.type} ${p.name};`);
    });
    lines.push('');

    // Constructor
    lines.push(`  ${className}({`);
    properties.forEach(p => {
        const required = !p.isOptional ? 'required ' : '';
        lines.push(`    ${required}this.${p.name},`);
    });
    lines.push(`  });`);
    lines.push('');

    // fromJson
    lines.push(`  factory ${className}.fromJson(Map<String, dynamic> json) {`);
    lines.push(`    return ${className}(`);
    properties.forEach(p => {
        const jsonKey = `json['${p.originalName}']`;
        let assignment = jsonKey;

        // Handle List mapping
        if (p.type.startsWith('List<')) {
            if (p.type.includes('dynamic')) {
                // List<dynamic> -> simple cast
                assignment = `(${jsonKey} as List<dynamic>?)?.toList() ?? []`;
                if (!p.isOptional) {
                    assignment = `(${jsonKey} as List<dynamic>).toList()`;
                }
            } else {
                const innerType = p.type.match(/List<(.+)>/)?.[1].replace('?', '');
                // Basic types don't need mapping, complex types do
                if (innerType && !['String', 'int', 'double', 'num', 'bool', 'DateTime'].includes(innerType)) {
                    if (p.isOptional) {
                        assignment = `(${jsonKey} as List<dynamic>?)?.map((e) => ${innerType}.fromJson(e as Map<String, dynamic>)).toList()`;
                    } else {
                        assignment = `(${jsonKey} as List<dynamic>).map((e) => ${innerType}.fromJson(e as Map<String, dynamic>)).toList()`;
                    }
                } else if (p.isOptional) {
                    assignment = `(${jsonKey} as List<dynamic>?)?.map((e) => e as ${innerType}).toList()`;
                } else {
                    // Simple cast for primitive list
                    assignment = `(${jsonKey} as List<dynamic>).map((e) => e as ${innerType}).toList()`;
                }
            }
        }
        // Handle DateTime
        else if (p.type.startsWith('DateTime')) {
            if (p.isOptional) {
                assignment = `${jsonKey} == null ? null : DateTime.parse(${jsonKey} as String)`;
            } else {
                assignment = `DateTime.parse(${jsonKey} as String)`;
            }
        }
        // Handle Nested Objects (non-list)
        else {
            const cleanType = p.type.replace('?', '');
            if (!['String', 'int', 'double', 'num', 'bool', 'dynamic'].includes(cleanType)) {
                // Check if it is an Enum
                if (knownEnums.has(cleanType)) {
                    if (p.isOptional) {
                        assignment = `${jsonKey} == null ? null : ${cleanType}.fromJson(${jsonKey})`;
                    } else {
                        assignment = `${cleanType}.fromJson(${jsonKey})`;
                    }
                } else {
                    // Assume it's a DTO/Class
                    if (p.isOptional) {
                        assignment = `${jsonKey} == null ? null : ${cleanType}.fromJson(${jsonKey} as Map<String, dynamic>)`;
                    } else {
                        assignment = `${cleanType}.fromJson(${jsonKey} as Map<String, dynamic>)`;
                    }
                }
            } else {
                // Primitive cast
                assignment = `${jsonKey} as ${p.type}`;
            }
        }

        lines.push(`      ${p.name}: ${assignment},`);
    });
    lines.push(`    );`);
    lines.push(`  }`);

    lines.push(`  Map<String, dynamic> toJson() {`);
    lines.push(`    return {`);
    properties.forEach(p => {
        let value = `this.${p.name}`;

        // Handle List mapping
        if (p.type.startsWith('List<')) {
            if (p.type.includes('dynamic')) {
                // List<dynamic> -> pass through
                // No change needed to value usually, unless deep copy needed?
                // value is already List<dynamic>
            } else {
                const innerType = p.type.match(/List<(.+)>/)?.[1].replace('?', '');
                if (innerType && !['String', 'int', 'double', 'num', 'bool', 'DateTime'].includes(innerType)) {
                    if (p.isOptional) {
                        value = `${value}?.map((e) => e.toJson()).toList()`;
                    } else {
                        value = `${value}.map((e) => e.toJson()).toList()`;
                    }
                }
            }
        } else if (p.type.startsWith('DateTime')) {
            if (p.isOptional) {
                value = `${value}?.toIso8601String()`;
            } else {
                value = `${value}.toIso8601String()`;
            }
        }
        // Handle Nested Objects
        else {
            const cleanType = p.type.replace('?', '');
            if (!['String', 'int', 'double', 'num', 'bool', 'dynamic'].includes(cleanType)) {
                // Assume it's a DTO/Class or Enum (both use toJson)
                if (p.isOptional) {
                    value = `${value}?.toJson()`;
                } else {
                    value = `${value}.toJson()`;
                }
            }
        }

        lines.push(`      '${p.originalName}': ${value},`);
    });
    lines.push(`    };`);
    lines.push(`  }`);

    lines.push(`}`);
    return lines.join('\n');
}

// Main logic
async function main() {
    console.log('Generating Dart models...');

    // Explicitly add source files to ensure they are found even if not in tsconfig scope initially
    const patterns = [
        path.join(SHARED_ATLAS_PATH, 'dto/*.ts'),
        path.join(SHARED_ATLAS_PATH, 'interfaces/*.ts'),
        path.join(SHARED_ATLAS_PATH, 'constants/*.ts'), // Include constants just in case they have enums
    ];
    console.log('Searching in patterns:', patterns);

    const sourceFiles = project.addSourceFilesAtPaths(patterns);
    console.log(`Found ${sourceFiles.length} source files.`);

    const generatedFiles: string[] = [];

    // Helper to save file with directory structure
    function saveFileWithStructure(sourceFile: any, name: string, content: string) {
        const sourcePath = sourceFile.getFilePath();
        const relativePath = path.relative(SHARED_ATLAS_PATH, sourcePath);
        const relativeDir = path.dirname(relativePath);

        // Target dir: lib/src/<relativeDir>
        const targetDir = path.join(LIB_DIR, 'src', relativeDir);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const fileName = toSnakeCase(name) + '.dart';
        const filePath = path.join(targetDir, fileName);
        fs.writeFileSync(filePath, content);

        console.log(`Generated ${fileName} in ${relativeDir}`);

        // Return export path relative to LIB_DIR
        // e.g. src/dto/chat_dto.dart
        const exportPath = path.join('src', relativeDir, fileName).replace(/\\/g, '/');
        generatedFiles.push(exportPath);
    }

    // Pass 1: Collect known Enums
    const knownEnums = new Set<string>();
    for (const sourceFile of sourceFiles) {
        for (const enm of sourceFile.getEnums()) {
            if (enm.isExported()) {
                knownEnums.add(enm.getName());
            }
        }
    }
    console.log('Found Enums:', knownEnums);

    // Pass 2: Generate code
    for (const sourceFile of sourceFiles) {
        // Classes
        for (const cls of sourceFile.getClasses()) {
            const className = cls.getName();
            if (!className || !cls.isExported()) continue;
            const dartCode = generateDartClass(cls, knownEnums);
            if (!dartCode) continue;
            saveFileWithStructure(sourceFile, className, dartCode);
        }

        // Interfaces -> Classes
        for (const iface of sourceFile.getInterfaces()) {
            const ifaceName = iface.getName();
            if (!ifaceName || !iface.isExported()) continue;
            // Treat interface as class
            const dartCode = generateDartClass(iface, knownEnums);
            if (!dartCode) continue;
            saveFileWithStructure(sourceFile, ifaceName, dartCode);
        }

        // Enums
        for (const enm of sourceFile.getEnums()) {
            const enumName = enm.getName();
            if (!enumName || !enm.isExported()) continue;
            const dartCode = generateDartEnum(enm);
            if (!dartCode) continue;
            saveFileWithStructure(sourceFile, enumName, dartCode);
        }
    }

    // Generate exports file
    const exportContent = generatedFiles.map(f => `export '${f}';`).join('\n');
    fs.writeFileSync(path.join(LIB_DIR, 'shared_atlas_dart.dart'), exportContent);

    // Read version from shared-atlas package.json
    const packageJsonPath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const baseVersion = packageJson.version || '0.0.1';
    // Use Seconds since 2025-01-01 Base36 for short unique (approx 5 chars)
    // 1735689600000 is 2025-01-01
    const epoch = 1735689600000;
    const seconds = Math.floor((Date.now() - epoch) / 1000);
    const buildSuffix = seconds.toString(36);
    const version = `${baseVersion}-${buildSuffix}`;
    console.log(`Using version: ${version}`);

    // Generate pubspec.yaml
    const pubspec = `
name: shared_atlas_dart
description: Generated Dart models for Tainiex Atlas
version: ${version}
homepage: https://github.com/tainiex/tainiex-atlas
repository: https://github.com/tainiex/tainiex-atlas
issue_tracker: https://github.com/tainiex/tainiex-atlas/issues
environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  meta: ^1.7.0
`;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'pubspec.yaml'), pubspec.trim());

    // Copy LICENSE from root
    const rootLicensePath = path.join(__dirname, '../../LICENSE');
    if (fs.existsSync(rootLicensePath)) {
        fs.copyFileSync(rootLicensePath, path.join(OUTPUT_DIR, 'LICENSE'));
        console.log('Copied LICENSE');
    } else {
        console.warn('Warning: Root LICENSE file not found. Please create one.');
    }

    // Generate README.md
    const readme = `
# shared_atlas_dart

Generated Dart models for Tainiex Atlas.
This package is automatically generated from the [\`shared-atlas\`](https://github.com/tainiex/tainiex-atlas/tree/main/shared-atlas) TypeScript definitions.

## Installation

Add this to your \`pubspec.yaml\`:

\`\`\`yaml
dependencies:
  shared_atlas_dart: ^${version}
\`\`\`

## Usage

\`\`\`dart
import 'package:shared_atlas_dart/shared_atlas_dart.dart';

// Use your DTOs here
\`\`\`

## License

Apache 2.0
`;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'README.md'), readme.trim());
    console.log('Generated README.md');

    // Generate CHANGELOG.md (Simple stub)
    const changelog = `
## ${version}

- Auto-generated update matching shared-atlas version ${version}.
`;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'CHANGELOG.md'), changelog.trim());
    console.log('Generated CHANGELOG.md');

    console.log('Done!');
}

main().catch(console.error);
