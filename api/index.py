import os
import json
from flask import Flask, jsonify, request, send_from_directory
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup Flask app
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
app = Flask(__name__, static_folder=ROOT_DIR, static_url_path='')

DATABASE_URL = os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL')
is_postgres = False

if DATABASE_URL and (DATABASE_URL.startswith('postgres://') or DATABASE_URL.startswith('postgresql://')):
    is_postgres = True
    import psycopg2
    from psycopg2.extras import RealDictCursor, Json
    print("Database Mode: PostgreSQL (Neon)")
else:
    import sqlite3
    print("Database Mode: SQLite (Local salesflow.db)")

def get_db_connection():
    if is_postgres:
        # Normalize postgres:// to postgresql:// for compatibility with psycopg2
        url = DATABASE_URL
        if url.startswith('postgres://'):
            url = url.replace('postgres://', 'postgresql://', 1)
        return psycopg2.connect(url)
    else:
        # Vercel filesystem is read-only, so use /tmp for SQLite writes
        if os.environ.get('VERCEL') == '1':
            db_path = '/tmp/salesflow.db'
        else:
            db_path = os.path.join(ROOT_DIR, 'salesflow.db')
            
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn

def p(query_str):
    """Replaces PostgreSQL placeholder %s with SQLite placeholder ? if running SQLite."""
    if not is_postgres:
        return query_str.replace('%s', '?')
    return query_str

def prepare_json(data):
    if is_postgres:
        return Json(data)
    else:
        return json.dumps(data)

def parse_json(val):
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return val
    return val

def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Create projects table
        cur.execute(p("""
            CREATE TABLE IF NOT EXISTS projects (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                template_type VARCHAR(50) NOT NULL
            );
        """))
        
        # Create tasks table
        if is_postgres:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id VARCHAR(50) PRIMARY KEY,
                    project_type VARCHAR(50) NOT NULL,
                    data JSONB NOT NULL
                );
            """)
        else:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id VARCHAR(50) PRIMARY KEY,
                    project_type VARCHAR(50) NOT NULL,
                    data TEXT NOT NULL
                );
            """)
        
        # Seed default projects if none exist
        cur.execute("SELECT COUNT(*) FROM projects;")
        count = cur.fetchone()[0]
        if count == 0:
            default_projects = [
                ('digital-marketing', 'Digital Marketing', 'digital-marketing'),
                ('nable-attendance', 'Nable Attendance Software', 'nable-attendance'),
                ('bni-tasks', 'BNI Tasks', 'bni-tasks')
            ]
            for id_, name, template in default_projects:
                cur.execute(
                    p("INSERT INTO projects (id, name, template_type) VALUES (%s, %s, %s);"),
                    (id_, name, template)
                )
        conn.commit()
        print("Database initialized successfully.")
    except Exception as e:
        conn.rollback()
        print("Failed to initialize database:", e)
    finally:
        cur.close()
        conn.close()

# Try initializing database
try:
    init_db()
except Exception as e:
    print("Database init failed on startup:", e)

# CORS fallback headers for easy API access
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# GET ALL DATA (Tasks + Projects)
@app.route('/api/data', methods=['GET'])
def get_data():
    try:
        conn = get_db_connection()
        if is_postgres:
            cur = conn.cursor(cursor_factory=RealDictCursor)
        else:
            cur = conn.cursor()
        
        # Fetch projects
        cur.execute(p("SELECT id, name, template_type AS \"templateType\" FROM projects;"))
        projects_rows = cur.fetchall()
        projects = []
        for row in projects_rows:
            if is_postgres:
                projects.append(dict(row))
            else:
                projects.append({
                    "id": row["id"],
                    "name": row["name"],
                    "templateType": row["templateType"]
                })
        
        # Fetch tasks
        cur.execute(p("SELECT data FROM tasks;"))
        tasks_rows = cur.fetchall()
        tasks = []
        for row in tasks_rows:
            tasks.append(parse_json(row['data']))
        
        cur.close()
        conn.close()
        
        return jsonify({
            "projects": projects,
            "tasks": tasks
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# DATABASE DIAGNOSTICS & HEALTH CHECK
@app.route('/api/diagnostics', methods=['GET'])
def get_diagnostics():
    status = {
        "db_mode": "PostgreSQL" if is_postgres else "SQLite",
        "connection": "Unknown",
        "write_test": "Unknown",
        "vercel_environment": os.environ.get('VERCEL') == '1',
        "database_url_configured": bool(os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL')),
        "gemini_api_key_configured": bool(os.environ.get('GEMINI_API_KEY'))
    }
    
    try:
        conn = get_db_connection()
        status["connection"] = "Success"
        cur = conn.cursor()
        
        # Test writeability / select counts
        try:
            cur.execute("SELECT COUNT(*) FROM projects;")
            status["projects_count"] = cur.fetchone()[0]
            
            cur.execute("SELECT COUNT(*) FROM tasks;")
            status["tasks_count"] = cur.fetchone()[0]
            status["write_test"] = "Success (Read verified)"
        except Exception as write_err:
            status["write_test"] = f"Failed: {str(write_err)}"
            
        cur.close()
        conn.close()
    except Exception as conn_err:
        status["connection"] = f"Failed: {str(conn_err)}"
        
    return jsonify(status)

# SAVE NEW PROJECT
@app.route('/api/projects', methods=['POST'])
def save_project():
    try:
        proj_data = request.json
        id_ = proj_data.get('id')
        name = proj_data.get('name')
        template_type = proj_data.get('templateType')
        
        if not id_ or not name or not template_type:
            return jsonify({"error": "Missing project fields"}), 400
            
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute(p("""
            INSERT INTO projects (id, name, template_type)
            VALUES (%s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, template_type = EXCLUDED.template_type;
        """), (id_, name, template_type))
        
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# RENAME PROJECT
@app.route('/api/projects/<id>', methods=['PUT'])
def rename_project(id):
    try:
        body = request.json
        new_name = body.get('name')
        if not new_name:
            return jsonify({"error": "Missing name"}), 400
            
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(p("UPDATE projects SET name = %s WHERE id = %s;"), (new_name, id))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# DELETE PROJECT AND CASCADING TASKS
@app.route('/api/projects/<id>', methods=['DELETE'])
def delete_project(id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Delete tasks first
        cur.execute(p("DELETE FROM tasks WHERE project_type = %s;"), (id,))
        # Delete project
        cur.execute(p("DELETE FROM projects WHERE id = %s;"), (id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# SAVE OR UPDATE TASK
@app.route('/api/tasks', methods=['POST'])
def save_task():
    try:
        task_data = request.json
        id_ = task_data.get('id')
        project_type = task_data.get('projectType')
        
        if not id_ or not project_type:
            return jsonify({"error": "Missing id or projectType"}), 400
            
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute(p("""
            INSERT INTO tasks (id, project_type, data)
            VALUES (%s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET project_type = EXCLUDED.project_type, data = EXCLUDED.data;
        """), (id_, project_type, prepare_json(task_data)))
        
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# DELETE TASK
@app.route('/api/tasks/<id>', methods=['DELETE'])
def delete_task(id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(p("DELETE FROM tasks WHERE id = %s;"), (id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# SYNC FULL DATABASE (Restore backup)
@app.route('/api/sync-full', methods=['POST'])
def sync_full():
    try:
        payload = request.json
        projects = payload.get('projects')
        tasks = payload.get('tasks')
        
        if projects is None or tasks is None:
            return jsonify({"error": "Missing projects or tasks array"}), 400
            
        conn = get_db_connection()
        cur = conn.cursor()
        
        try:
            # Clear existing tables
            cur.execute("DELETE FROM tasks;")
            cur.execute("DELETE FROM projects;")
            
            # Insert new projects
            for p_item in projects:
                cur.execute(
                    p("INSERT INTO projects (id, name, template_type) VALUES (%s, %s, %s);"),
                    (p_item['id'], p_item['name'], p_item['templateType'])
                )
                
            # Insert new tasks
            for t_item in tasks:
                cur.execute(
                    p("INSERT INTO tasks (id, project_type, data) VALUES (%s, %s, %s);"),
                    (t_item['id'], t_item['projectType'], prepare_json(t_item))
                )
                
            conn.commit()
            return jsonify({"success": True})
        except Exception as err:
            conn.rollback()
            raise err
        finally:
            cur.close()
            conn.close()
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# AI TASK & COMMENTS SUMMARIZER (Gemini API / Heuristic Fallback)
@app.route('/api/ai/summarize', methods=['POST'])
def ai_summarize():
    try:
        body = request.json or {}
        title = body.get('title', 'Untitled Task')
        client_name = body.get('clientName', '')
        description = body.get('description', '')
        history = body.get('history', [])
        
        # Build client label
        client_label = client_name.strip()
        
        # Generate the Title in format: Title / Client Name
        full_title = title
        if client_label:
            full_title = f"{title} / {client_label}"
            
        # Format the history events
        history_str = ""
        if isinstance(history, list):
            for event in history:
                msg = event.get('message', '')
                user = event.get('user', 'You')
                ts = event.get('timestamp', '')
                if msg:
                    history_str += f"- [{ts}] {user}: {msg}\n"
                    
        # Check if GEMINI_API_KEY is available
        api_key = os.environ.get('GEMINI_API_KEY')
        ai_summary = ""
        
        if api_key:
            import urllib.request
            
            prompt = (
                "You are an AI assistant built into a CRM. Summarize the following task details "
                "and its history log into a concise event description suitable for a Google Calendar event. "
                "Keep it brief (max 3-4 bullet points), professional, and highlight the most recent updates, "
                "next action details, and pending blockers. Do NOT add any preamble like 'Here is the summary' or "
                "markdown code blocks, just output the plain text description.\n\n"
                f"Task Title: {title}\n"
                f"Client Name: {client_label}\n"
                f"Main Description: {description}\n"
                f"History / Comments:\n{history_str}"
            )
            
            payload = {
                "contents": [{
                    "parts": [{"text": prompt}]
                }]
            }
            
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
            req_data = json.dumps(payload).encode('utf-8')
            
            req = urllib.request.Request(
                url, 
                data=req_data, 
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            
            try:
                with urllib.request.urlopen(req, timeout=8) as response:
                    res_body = response.read().decode('utf-8')
                    res_json = json.loads(res_body)
                    candidates = res_json.get('candidates', [])
                    if candidates:
                        parts = candidates[0].get('content', {}).get('parts', [])
                        if parts:
                            ai_summary = parts[0].get('text', '').strip()
            except Exception as e:
                print("Gemini API call failed:", e)
                
        # If API key is missing or call failed, use a high-quality heuristic local summarizer
        if not ai_summary:
            ai_summary = "Task details:\n"
            if description.strip():
                ai_summary += f"- Main details: {description.strip()}\n"
            else:
                ai_summary += "- No main description details provided.\n"
                
            if history_str:
                ai_summary += "\nRecent Updates:\n"
                recent_logs = history[-3:] if isinstance(history, list) else []
                for event in recent_logs:
                    msg = event.get('message', '')
                    if msg:
                        ai_summary += f"- {msg}\n"
                        
        return jsonify({
            "success": True,
            "title": full_title,
            "summary": ai_summary
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# STATIC FRONTEND FALLBACKS
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)
