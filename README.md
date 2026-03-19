# MultiLabel YOLO

A modern, web-based annotation tool for creating YOLO-format object detection datasets. Built with FastAPI and a sleek vanilla JavaScript frontend.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.8+-blue.svg)
![PyPI](https://img.shields.io/pypi/v/multilabel-yolo.svg)

---

## ✨ Features

- **🎯 YOLO Format Support** – Export labels in standard 5-value and 6-value (with confidence) YOLO format
- **📁 Flexible Dataset Structure** – Supports both flat folders and nested session-based layouts
- **🎨 Smart Class Management** – Dynamic class creation, editing, and `classes.txt` auto-save
- **🔍 Zoom & Pan** – Smooth zoom (Ctrl+Scroll), pan (Space+Drag or middle-mouse), and fit-to-view
- **⌨️ Keyboard Shortcuts** – Optimized workflow with extensive keyboard shortcuts
- **💾 Auto-Save Ready** – Labels saved as `.txt` files paired with images
- **🌐 Local Browser** – Built-in file browser to navigate and load any dataset folder
- **📊 Progress Tracking** – Visual progress bars and labeled image counts

---

## 📦 Installation

### From PyPI (Recommended)

```bash
pip install multilabel-yolo
```

### From Source

```bash
git clone https://github.com/sdburde/multiclass_yolo_labeling.git
cd multiclass_yolo_labeling
pip install -e .
```

### Development Installation

```bash
pip install -e ".[dev]"
```

---

## 🚀 Quick Start

### Run the Application

```bash
multilabel-yolo
```

The application will start on **http://127.0.0.1:7182**

### Custom Host/Port

```bash
multilabel-yolo --host 0.0.0.0 --port 8080
```

### Disable Auto-Reload

```bash
multilabel-yolo --no-reload
```

### View Help

```bash
multilabel-yolo --help
```

### Using as a Python Library

```python
from multilabel_yolo import run_server

# Run the server programmatically
run_server(host="127.0.0.1", port=7182, reload=True)
```

Or access the FastAPI app directly:

```python
from multilabel_yolo import app

# Use with your own uvicorn configuration
import uvicorn
uvicorn.run(app, host="127.0.0.1", port=7182)
```

---

## 📖 Usage Guide

### Loading a Dataset

1. Click the **📂 Click to open dataset folder…** button in the top bar
2. Browse to your dataset folder containing images
3. Click **Open Dataset ▶** to load

The tool auto-detects:
- **Flat layout**: All images in one folder
- **Nested layout**: Multiple sub-folders (sessions) with images

### Creating Annotations

1. **Select a class** from the dropdown or use number keys `0-9`
2. **Draw a bounding box**: Click and drag on the image
3. **Adjust boxes**:
   - Drag from inside to move
   - Drag handles to resize
4. **Save**: Press `S` or click **💾 Save**

### Managing Classes

1. Open the **Classes** panel on the right
2. Click **+ Add** to create new classes
3. Click on class names to rename them
4. Click **💾** to save `classes.txt`

### Navigation

| Action | Shortcut |
|--------|----------|
| Previous image | `A` or **◀ Prev** button |
| Next image | `D` or **Next ▶** button |
| Save labels | `S` |
| Undo last box | `Ctrl+Z` or **↩ Undo** |
| Delete selected box | `Delete` / `Backspace` |
| Select class 0-9 | Number keys `0` through `9` |
| Pan mode toggle | Click **✋ Pan** button |
| Temporary pan | Hold `Space` or middle-mouse button |
| Zoom in/out | `Ctrl` + Scroll or **+** / **−** buttons |
| Fit to view | `F` or **⊡ Fit** button |
| Reset zoom (100%) | **1:1** button |

---

## 📁 Dataset Format

### Folder Structure

**Flat Layout:**
```
my_dataset/
├── classes.txt
├── image1.jpg
├── image1.txt
├── image2.png
├── image2.txt
└── ...
```

**Nested Layout (Sessions):**
```
my_dataset/
├── session_1/
│   ├── classes.txt
│   ├── img1.jpg
│   └── img1.txt
├── session_2/
│   ├── classes.txt
│   ├── img2.jpg
│   └── img2.txt
└── ...
```

### Label File Format (YOLO)

Each `.txt` file contains one bounding box per line:

**5-value format (standard):**
```
<class_id> <cx> <cy> <bw> <bh>
```

**6-value format (with confidence):**
```
<class_id> <cx> <cy> <bw> <bh> <confidence>
```

Where:
- `class_id`: Integer (0-indexed)
- `cx`, `cy`: Normalized center coordinates (0-1)
- `bw`, `bh`: Normalized box width and height (0-1)

### Classes File Format

`classes.txt` contains one class name per line:
```
person
car
dog
cat
```

---

## 🛠️ API Endpoints

When running, the application exposes these endpoints at `http://localhost:7182`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serve the main application |
| `/api/browse` | POST | Browse directories |
| `/api/load_dataset` | POST | Load a dataset folder |
| `/api/image` | GET | Get image as base64 |
| `/api/labels` | GET | Get labels for an image |
| `/api/labels` | POST | Save labels for an image |
| `/api/save_classes` | POST | Save `classes.txt` |

Interactive API docs available at: `http://localhost:7182/docs`

---

## 🎨 Architecture

```
multilabel_yolo/
├── __init__.py       # Package initialization
├── server.py         # FastAPI backend
├── cli.py            # Command-line interface
└── static/
    ├── index.html    # Main HTML structure
    ├── styles.css    # All styles
    └── app.js        # Frontend application logic
```

---

## 🔧 Configuration

### Change Port

```bash
multilabel-yolo --port 8080
```

### Change Host

```bash
multilabel-yolo --host 0.0.0.0
```

### Disable Reload

```bash
multilabel-yolo --no-reload
```

---

## 🐛 Troubleshooting

### Labels Not Saving

**Issue:** Labels not being saved to `.txt` files

**Solution:** Check browser console for errors. Ensure the server is running and you have write permissions in the dataset folder.

### Images Not Loading

**Issue:** Images show as broken or don't appear

**Solution:**
- Verify image formats are supported (`.jpg`, `.jpeg`, `.png`, `.bmp`, `.webp`)
- Check file permissions
- Ensure the path doesn't contain special characters

### Port Already in Use

**Issue:** `Error: [Errno 98] Address already in use`

**Solution:**
- Use a different port: `multilabel-yolo --port 8080`
- Or kill the process using the port: `lsof -i :7182` then `kill <PID>`

### Module Not Found After Install

**Issue:** `ModuleNotFoundError: No module named 'multilabel_yolo'`

**Solution:**
- Ensure you're using the correct Python environment
- Reinstall: `pip install --upgrade multilabel-yolo`

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting: `pytest && black . && ruff check .`
5. Submit a pull request

### Development Setup

```bash
git clone https://github.com/sdburde/multiclass_yolo_labeling.git
cd multiclass_yolo_labeling
pip install -e ".[dev]"
```

---

## 📝 License

MIT License – feel free to use and modify for your projects.

---

## 📧 Support

For issues, questions, or feature requests, please open an issue on the [GitHub repository](https://github.com/sdburde/multiclass_yolo_labeling/issues).

---

**Happy Annotating! 🎉**
