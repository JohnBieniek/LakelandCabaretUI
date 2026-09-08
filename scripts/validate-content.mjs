import { readFileSync, existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../', import.meta.url));
export const config = parse(readFileSync(resolve(root, '.pages.yml'), 'utf8'));

export function validateFields(fields, data, path = 'content') {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error(`${path}: expected an object`);
  for (const field of fields) {
    const value = data[field.name];
    const label = `${path}.${field.name}`;
    if (value == null || value === '') {
      if (field.required) throw new Error(`${label}: required`);
      continue;
    }
    if (field.list) {
      if (!Array.isArray(value)) throw new Error(`${label}: expected a list`);
      const { min = 0, max = Infinity } = field.list;
      if (value.length < min || value.length > max)
        throw new Error(`${label}: expected ${min}–${max} items`);
      value.forEach((item, index) => validateValue(field, item, `${label}[${index}]`));
    } else validateValue(field, value, label);
  }
}

function validateValue(field, value, label) {
  if (field.type === 'object') return validateFields(field.fields, value, label);
  if (typeof value !== 'string' || (field.required && !value.trim()))
    throw new Error(`${label}: expected text`);
  if (field.type === 'image') {
    const imageRoot = resolve(root, 'public/images') + sep;
    const imagePath = resolve(root, 'public', '.' + value);
    if (
      !value.startsWith('/images/') ||
      !imagePath.startsWith(imageRoot) ||
      !existsSync(imagePath)
    ) {
      throw new Error(`${label}: image must exist in public/images`);
    }
    if (!/\.(jpe?g|png|webp|avif)$/i.test(value))
      throw new Error(`${label}: unsupported image format`);
  }
  if (field.name === 'email' && !/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(value))
    throw new Error(`${label}: invalid email`);
  if (field.name === 'phone' && !/^\+?[\d\s().-]{7,30}$/.test(value))
    throw new Error(`${label}: invalid phone number`);
}

export function validateContent() {
  for (const entry of config.content) {
    validateFields(
      entry.fields,
      JSON.parse(readFileSync(resolve(root, entry.path), 'utf8')),
      entry.path,
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validateContent();
  console.log(`Validated ${config.content.length} CMS content files and their image references.`);
}
