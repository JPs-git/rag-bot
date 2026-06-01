import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_ID = 'Xenova/multilingual-e5-small';
const MODEL_DIR = path.resolve(__dirname, '..', 'public', 'models', MODEL_ID.replace('/', path.sep));

const FILES_TO_DOWNLOAD = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'special_tokens_map.json',
  'sentencepiece.bpe.model',
  'quant_config.json',
  'onnx/model_quantized.onnx',
];

const BASE_URLS = [
  'https://huggingface.co',
  'https://hf-mirror.com',
];

let currentBaseUrlIndex = 0;

function getCurrentBaseUrl() {
  return BASE_URLS[currentBaseUrlIndex];
}

function switchToNextMirror() {
  currentBaseUrlIndex = (currentBaseUrlIndex + 1) % BASE_URLS.length;
  console.log(`  Switching to mirror: ${getCurrentBaseUrl()}`);
}

async function downloadFileWithRetry(filePath, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const url = `${getCurrentBaseUrl()}/${MODEL_ID}/resolve/main/${filePath}`;
    const destPath = path.join(MODEL_DIR, filePath);
    
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    console.log(`Downloading: ${filePath} (attempt ${attempt}/${maxRetries})`);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(destPath, Buffer.from(buffer));
      console.log(`  ✓ Downloaded: ${filePath}`);
      return;
    } catch (error) {
      console.error(`  ✗ Attempt ${attempt} failed: ${error.message}`);
      if (attempt < maxRetries) {
        switchToNextMirror();
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } else {
        throw new Error(`Failed to download ${filePath} after ${maxRetries} attempts`);
      }
    }
  }
}

async function main() {
  console.log(`Downloading model: ${MODEL_ID}`);
  console.log(`Destination: ${MODEL_DIR}`);
  console.log(`Available mirrors: ${BASE_URLS.join(', ')}`);
  console.log('='.repeat(60));
  
  try {
    for (const file of FILES_TO_DOWNLOAD) {
      await downloadFileWithRetry(file);
    }
    
    console.log('='.repeat(60));
    console.log('✓ Model downloaded successfully!');
    console.log(`  To run the app: npm run dev`);
  } catch (error) {
    console.error('='.repeat(60));
    console.error('✗ Failed to download model:', error.message);
    console.error('  Please try again later or download manually from:');
    console.error(`  https://huggingface.co/${MODEL_ID}`);
    process.exit(1);
  }
}

main();
