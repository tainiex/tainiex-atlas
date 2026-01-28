import { Project } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

const SHARED_ATLAS_PATH = path.join(__dirname, '../src');
const OUTPUT_DIR = path.join(__dirname, '../../shared-atlas-dart/lib/src');

// Initialize ts-morph project
const project = new Project({
    tsConfigFilePath: path.join(__dirname, '../tsconfig.json'),
});

// Helper to convert PascalCase to snake_case for filenames (must match generate-dart.ts logic)
function toSnakeCase(str: string): string {
    return str
        .replace(/\.?([A-Z]+)/g, (x, y) => '_' + y.toLowerCase())
        .replace(/^_/, '');
}

async function main() {
    console.log('Verifying Dart structure consistency...');

    const patterns = [
        path.join(SHARED_ATLAS_PATH, 'dto/*.ts'),
        path.join(SHARED_ATLAS_PATH, 'interfaces/*.ts'),
        path.join(SHARED_ATLAS_PATH, 'constants/*.ts'),
    ];

    // Explicitly add exported declarations source files only
    const sourceFiles = project.addSourceFilesAtPaths(patterns);
    let missingFiles = 0;
    let checkedFiles = 0;

    for (const sourceFile of sourceFiles) {
        // Evaluate if this file exports anything interesting (Class, Interface, Enum)
        const hasExports = sourceFile.getClasses().some(c => c.isExported()) ||
            sourceFile.getInterfaces().some(i => i.isExported()) ||
            sourceFile.getEnums().some(e => e.isExported());

        if (!hasExports) continue;

        // Determine expected Dart file path
        // Logic: For each exported item, we generated a file. 
        // Wait, generate-dart.ts generates ONE FILE PER CLASS/INTERFACE/ENUM, not per SourceFile.
        // So we need to check each exported item.

        const relativePath = path.relative(SHARED_ATLAS_PATH, sourceFile.getFilePath());
        const relativeDir = path.dirname(relativePath); // e.g. "dto"

        const itemsToCheck: string[] = [
            ...sourceFile.getClasses().filter(c => c.isExported()).map(c => c.getName()),
            ...sourceFile.getInterfaces().filter(i => i.isExported()).map(i => i.getName()),
            ...sourceFile.getEnums().filter(e => e.isExported()).map(e => e.getName())
        ].filter((n): n is string => !!n);

        for (const itemName of itemsToCheck) {
            checkedFiles++;
            const expectedFileName = toSnakeCase(itemName) + '.dart';
            const expectedFilePath = path.join(OUTPUT_DIR, relativeDir, expectedFileName);

            if (!fs.existsSync(expectedFilePath)) {
                console.error(`[MISSING_FILE] ${itemName} -> ${expectedFilePath}`);
                missingFiles++;
                continue;
            }

            // Deep Content Verification
            const dartContent = fs.readFileSync(expectedFilePath, 'utf-8');
            const dartFields = extractDartFields(dartContent, itemName);

            // Get TS properties
            let tsProps: { name: string; type: string; isOptional: boolean }[] = [];

            const cls = sourceFile.getClass(itemName);
            const iface = sourceFile.getInterface(itemName);

            if (cls) {
                tsProps = cls.getProperties().map(p => ({
                    name: p.getName(),
                    type: p.getType().getText(),
                    isOptional: p.hasQuestionToken() || p.getDecorators().some(d => d.getName() === 'IsOptional')
                }));
            } else if (iface) {
                tsProps = iface.getProperties().map(p => ({
                    name: p.getName(),
                    type: p.getType().getText(),
                    isOptional: p.hasQuestionToken()
                }));
            }

            // Compare properties
            for (const prop of tsProps) {
                // Sanitize name for Dart (replace non-alphanumeric with _)
                let sanitizedName = prop.name.replace(/^['"]|['"]$/g, '').replace(/[^a-zA-Z0-9$]/g, '_');

                // Handle reserved keywords
                if (['in', 'is', 'var', 'final', 'const', 'class', 'enum', 'default', 'extends', 'with', 'implements'].includes(sanitizedName)) {
                    sanitizedName = sanitizedName + '_';
                }

                const dartField = dartFields.find(f => f.name === sanitizedName);
                if (!dartField) {
                    console.error(`[MISSING_FIELD] ${itemName}.${prop.name} (Sanitized: ${sanitizedName}) (Dart file: ${expectedFileName})`);
                    missingFiles++; // Count as error
                    continue;
                }

                // Flexible type check (simplified)
                // ... (omitted for now)
            }
        }
    }

    if (missingFiles === 0) {
        console.log(`Verification Passed! Checked ${checkedFiles} files and their fields matches.`);
        process.exit(0);
    } else {
        console.error(`Verification Failed! Found ${missingFiles} errors.`);
        process.exit(1);
    }
}

// Simple regex-based Dart parser to extract fields
// Matches: final Type name;
function extractDartFields(content: string, className: string): { name: string; type: string }[] {
    const fields: { name: string; type: string }[] = [];
    // Regex for: final Type name;
    // We assume standard formatting from our generator
    const regex = /final\s+([\w<>?]+)\s+(\w+);/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        fields.push({
            type: match[1],
            name: match[2]
        });
    }
    return fields;
}

main().catch(console.error);
