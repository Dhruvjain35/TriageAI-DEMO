# TriageAI-DEMO

**Clinical Decision Support System for Emergency Triage Acuity Prediction**

Authors: Dhruv Jain & Sriyan Bodla

Live demo companion to our [Triagegeist Kaggle submission](https://www.kaggle.com/competitions/triagegeist).

## Setup

Requires Python 3.10+.

```bash
# Install dependencies
pip install -r requirements.txt

# Start the server
bash start.sh
```

The app will be available at `http://localhost:8000`.

## What This Does

This demo lets you input structured patient intake data (vitals, demographics, chief complaint) and returns a predicted ESI triage acuity level (1-5) with confidence scores and clinical explanations. It mirrors the prediction pipeline from our full Kaggle notebook.

## Files

| File | Description |
|------|-------------|
| `server.py` | FastAPI backend serving the prediction API and static files |
| `model.py` | Triage prediction model logic |
| `index.html` | Landing page |
| `demo.html` | Interactive demo interface |
| `app.js` | Frontend application logic |
| `styles.css` | Landing page styles |
| `demo.css` | Demo interface styles |
| `grain-shader.js` | Visual effects |
| `start.sh` | One-command startup script |
| `requirements.txt` | Python dependencies |

## Disclaimer

For research and demonstration purposes only. Not approved for clinical use.

## License

See [LICENSE](LICENSE) for details.
