# MultiLabel – YOLO Annotation Tool

A modern, feature-rich web-based annotation tool for creating YOLO-format object detection datasets. Built with FastAPI backend and a sleek vanilla JavaScript frontend.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.8+-blue.svg)
![FastAPI](https://img.shields.io/badge/fastapi-0.100+-green.svg)

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

### 1. Clone or Download

Navigate to your project directory:
```bash
cd /path/to/project
```

### 2. Create Virtual Environment (Optional but Recommended)

```bash
python -m venv myenv
source myenv/bin/activate  # On Windows: myenv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

---

## 🚀 Quick Start

### Start the Server

```bash
python main.py
```

The application will start on **http://127.0.0.1:7182**

### Open in Browser

Navigate to `http://127.0.0.1:7182` in your web browser.

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

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serve the main application |
| `/api/browse` | POST | Browse directories |
| `/api/load_dataset` | POST | Load a dataset folder |
| `/api/image` | GET | Get image as base64 |
| `/api/labels` | GET | Get labels for an image |
| `/api/labels` | POST | Save labels for an image |
| `/api/save_classes` | POST | Save `classes.txt` |

---

## 🎨 Architecture

```
project/
├── main.py              # FastAPI backend
├── requirements.txt     # Python dependencies
├── static/
│   ├── index.html       # Main HTML structure
│   ├── styles.css       # All styles
│   └── app.js           # Frontend application logic
└── myenv/               # Virtual environment (optional)
```

---

## 🔧 Configuration

### Change Port

Edit `main.py`:
```python
uvicorn.run(
    "main:app",
    host="127.0.0.1",
    port=7182,  # Change this
    reload=True
)
```

### Customize Colors

Edit `static/styles.css` CSS variables:
```css
:root {
  --accent: #5b8cff;    /* Primary accent color */
  --green: #3ddc84;     /* Success/positive */
  --warn: #f5a623;      /* Warning */
  --danger: #ff4f6d;    /* Error/delete */
}
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
- Change the port in `main.py`
- Or kill the process using the port: `lsof -i :7182` then `kill <PID>`

---

## 📝 License

MIT License – feel free to use and modify for your projects.

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📧 Support

For issues, questions, or feature requests, please open an issue on the repository.

---

**Happy Annotating! 🎉**
