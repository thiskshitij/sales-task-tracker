import sys
import os

# Add the current directory to sys.path so it can find the api module
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from api.index import app

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    print(f"Starting SalesFlow server locally on http://localhost:{port}...")
    app.run(host='0.0.0.0', port=port, debug=True)
