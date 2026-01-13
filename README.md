# Smart Tab Manager 🧠✨

> **Tame your browser chaos with AI.**

![License](https://img.shields.io/github/license/ayu5h-raj/smart-tab-manager)
![Version](https://img.shields.io/github/v/release/ayu5h-raj/smart-tab-manager)

**Smart Tab Manager** is a powerful Chrome Extension that uses Artificial Intelligence to automatically organize your messy browser tabs into logical, named groups.

Say goodbye to "tab overload" and focus on what matters.

## ✨ Features

- **🤖 AI-Powered Grouping**: Automatically analyzes your open tabs and sorts them into meaningful groups (e.g., "Dev Work", "Research", "Entertainment").
- **⚡ Universal LLM Support**: Connect to your favorite AI provider:
  - **Google Gemini** (Free tier available!)
  - **OpenAI** (GPT-4o, GPT-3.5)
  - **Anthropic** (Claude 3.5 Sonnet)
  - **OpenRouter** (DeepSeek, Llama 3, etc.)
  - **Custom endpoints** (LM Studio, Ollama)
- **🔍 Smart Search**: Instantly filter tabs by title or URL with a blazing fast search bar.
- **🔒 Privacy First**: Your API keys and tab data are stored **locally** in your browser. We never track you.
- **🎨 Modern UI**: A sleek, dark-mode optimized interface designed for speed.

## 🚀 Installation

### Option 1: Download Release (Easiest)
1.  Go to the [**Releases Page**](https://github.com/ayu5h-raj/smart-tab-manager/releases).
2.  Download the latest `smart-tab-manager-vX.X.X.zip`.
3.  Unzip the file.
4.  Open Chrome, Edge, or Brave and navigate to `chrome://extensions`.
5.  Toggle **Developer mode** (top right switch).
6.  Click **Load unpacked** and select the unzipped folder (the one containing `manifest.json`).

### Option 2: Build from Source
Requirements: Node.js 20+

```bash
# Clone the repository
git clone https://github.com/ayu5h-raj/smart-tab-manager.git
cd smart-tab-manager

# Install dependencies
npm install

# Build the extension
npm run build

# (Optional) Create a release zip
npm run release
```
After building, load the `dist` folder in `chrome://extensions`.

## 🛠 Usage

1.  **Open the Extension**: Click the Smart Tab Manager icon in your toolbar.
2.  **Configure AI**:
    - Click the **Gear Icon (⚙️)** in the top right.
    - Select your provider (e.g., **Gemini**).
    - Enter your **API Key** (stored locally).
    - (Optional) Customize the Model or Base URL.
3.  **Tidy Up**: Click the **"✨ Tidy Up"** button. Watch as your tabs get magically grouped!
4.  **Manage**: Search, close, or switch tabs directly from the popup.

## 🤝 Contributing

Contributions are welcome! Please feel free to [submit a Pull Request](https://github.com/ayu5h-raj/smart-tab-manager/pulls).

## 📄 License

MIT © [Ayush Raj](https://github.com/ayu5h-raj)
