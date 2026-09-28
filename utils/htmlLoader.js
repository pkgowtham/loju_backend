import { readFile } from "fs/promises";
import path from "path";

/**
 * Load and render HTML email template
 * @param {string} templateName - filename in template/email (without extension)
 * @param {object} variables - key-value pairs to replace in template
 * @returns {Promise<string>}
 */
export const renderEmailTemplate = async (templateName, variables = {}) => {
  const filePath = path.join(
    process.cwd(),
    "template",
    "email",
    `${templateName}.html`
  );

  let html = await readFile(filePath, "utf-8");

  // Replace {{key}} with value
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    html = html.replace(regex, value);
  }

  return html;
};
