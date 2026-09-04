from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import sqlite3
from flask_cors import CORS
import traceback
import os
import qrcode

app = Flask(__name__)
CORS(app)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "users.db")
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "KalaKriti", "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:5000") # Default local URL

def add_column_if_not_exists(conn, table, column, dtype):
    try:
        c = conn.cursor()
        c.execute(f"ALTER TABLE {table} ADD COLUMN {column} {dtype}")
        conn.commit()
        print(f'Added {column} column to {table} table')
    except Exception as e:
        if 'duplicate column name' not in str(e).lower():
            print(f'Error adding column {column}: {e}')

def add_column_if_not_exists(conn, table, column, dtype):
    """Safely add a column to a table if it doesn't exist"""
    try:
        c = conn.cursor()
        # Check if column exists
        c.execute(f"PRAGMA table_info({table})")
        columns = [row[1] for row in c.fetchall()]
        if column not in columns:
            c.execute(f"ALTER TABLE {table} ADD COLUMN {column} {dtype}")
            conn.commit()
            print(f'Added column {column} to {table} table')
        else:
            print(f'Column {column} already exists in {table} table')
    except Exception as e:
        print(f'Error handling column {column} in {table}: {e}')

def init_db():
    print("Initializing database at:", DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    print("Creating/verifying tables...")
    
    # Create tables
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_email TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            image TEXT,
            ar_url TEXT,
            qr_url TEXT,
            price REAL DEFAULT 0
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS workshops (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_email TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            date TEXT NOT NULL,
            duration INTEGER,
            mode TEXT,
            max_participants INTEGER,
            image TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            customer_email TEXT NOT NULL,
            agent_email TEXT NOT NULL
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            rating INTEGER NOT NULL,
            text TEXT NOT NULL,
            customer_email TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_email TEXT NOT NULL,
            product_id INTEGER,
            message TEXT NOT NULL,
            date_created TEXT NOT NULL
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS workshop_enrollments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workshop_id INTEGER NOT NULL,
            customer_email TEXT NOT NULL,
            enrollment_date TEXT NOT NULL
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS product_ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            customer_email TEXT NOT NULL,
            rating INTEGER NOT NULL,
            review_text TEXT,
            date_rated TEXT NOT NULL
        )
    ''')
    # Agent profiles table: stores profile details for agents
    c.execute('''
        CREATE TABLE IF NOT EXISTS agent_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            full_name TEXT,
            phone TEXT,
            shop_name TEXT,
            address TEXT,
            bio TEXT,
            payout_info TEXT,
            social TEXT,
            avatar TEXT,
            updated_at TEXT
        )
    ''')
    conn.commit()
    
    print("Ensuring all required columns exist...")
    
    # Add required columns if they don't exist
    try:
        # Products table columns
        add_column_if_not_exists(conn, 'products', 'price', 'REAL DEFAULT 0')
        add_column_if_not_exists(conn, 'products', 'qr_url', 'TEXT')
        add_column_if_not_exists(conn, 'products', 'category', 'TEXT')

        # Workshops table columns
        add_column_if_not_exists(conn, 'workshops', 'duration', 'INTEGER DEFAULT 1')
        add_column_if_not_exists(conn, 'workshops', 'mode', 'TEXT DEFAULT "online"')
        add_column_if_not_exists(conn, 'workshops', 'max_participants', 'INTEGER DEFAULT 20')

        print("Database initialization completed successfully")
    except Exception as e:
        print('Error during database initialization:', str(e))
        traceback.print_exc()
    finally:
        conn.close()

init_db()

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    print("Received registration data:", data)
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")
    role = data.get("role")
    if not all([username, email, password, role]):
        print("Missing fields in registration data.")
        return jsonify(success=False, message="All fields required.")
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT id FROM users WHERE email=?", (email,))
        if c.fetchone():
            conn.close()
            print("Email already registered:", email)
            return jsonify(success=False, message="Email already registered.")
        c.execute("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
                  (username, email, password, role))
        conn.commit()
        conn.close()
        print("Registration successful for:", email)
        return jsonify(success=True, message="✅ Registration Successful! You can now login.")
    except Exception as e:
        print("Registration error:", e)
        traceback.print_exc()
        try:
            conn.close()
        except:
            pass
        return jsonify(success=False, message="Registration failed. Server error.")

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    
    if not all([username, password]):
        return jsonify(success=False, message="Username and password required.")
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, username, role FROM users WHERE username=? AND password=?", (username, password))
    user = c.fetchone()
    conn.close()
    
    if user:
        user_role = user[2]
        return jsonify(success=True, message="✅ Login Successful! Welcome back to KalaKriti!", username=user[1], role=user_role)
    else:
        return jsonify(success=False, message="❌ Invalid credentials.")

@app.route("/", methods=["GET"])
def home():
    # Serve the login.html file from the KalaKriti folder
    return send_from_directory("KalaKriti", "login.html")

@app.route("/<path:filename>")
def static_files(filename):
    # Serve static files (JS, CSS, images, etc.) from the KalaKriti folder
    return send_from_directory("KalaKriti", filename)

# Serve AR viewer page
@app.route("/ar-view", methods=["GET"])
def ar_view_page():
    return send_from_directory("KalaKriti", "ar-view.html")

# Agent: Post product (with image)
@app.route("/agent/products", methods=["POST"])
def post_product():
    try:
        name = request.form.get("name")
        description = request.form.get("description")
        agent_email = request.form.get("agent_email")
        price = request.form.get("price")
        category = request.form.get("category")
        image = request.files.get("image")
        ar_image = request.files.get("ar_image")
        
        if not all([name, description, agent_email, price]):
            return jsonify(success=False, message="Missing required fields")
        
        image_filename = None
        ar_filename = None
        
        # Save product image (store filename in DB, return full URL in responses)
        if image:
            filename = f"product_{agent_email}_{name}_{image.filename}"
            image.save(os.path.join(UPLOAD_FOLDER, filename))
            image_filename = filename
            
        # Save AR/QR image and generate QR code
        qr_filename = None
        if ar_image:
            ar_filename = f"ar_{agent_email}_{name}_{ar_image.filename}"
            ar_image.save(os.path.join(UPLOAD_FOLDER, ar_filename))

            # Generate QR code for AR viewing
            ar_url = f"{BASE_URL}/ar-view?product_id={{product_id}}"
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(ar_url)
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color="black", back_color="white")

            qr_filename = f"qr_{agent_email}_{name}.png"
            qr_img.save(os.path.join(UPLOAD_FOLDER, qr_filename))

        # cast price to float (store numeric)
        try:
            price_val = float(price)
        except Exception:
            price_val = 0.0

        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("""
            INSERT INTO products (agent_email, name, description, image, ar_url, qr_url, price, category)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (agent_email, name, description, image_filename, ar_filename, qr_filename, price_val, category))

        # Get the product ID for QR URL
        product_id = c.lastrowid

        # Update QR URL with actual product ID
        if qr_filename:
            actual_ar_url = f"{BASE_URL}/ar-view?product_id={product_id}"
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(actual_ar_url)
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color="black", back_color="white")
            qr_img.save(os.path.join(UPLOAD_FOLDER, qr_filename))

        conn.commit()
        conn.close()
        
        return jsonify(success=True, message="Product posted successfully")
        
    except Exception as e:
        print("Product post error:", e)
        traceback.print_exc()
        return jsonify(success=False, message="Server error")

# Agent: View own products
@app.route("/agent/products", methods=["GET"])
def agent_products():
    agent_email = request.args.get("agent_email")
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, name, description, image, ar_url, qr_url, price, category FROM products WHERE agent_email=?", (agent_email,))
    products = []
    for r in c.fetchall():
        img = r[3]
        ar = r[4]
        qr = r[5]
        products.append({
            "id": r[0], "name": r[1], "description": r[2],
            "image": img,
            "image_url": (f"http://127.0.0.1:5000/uploads/{img}" if img else None),
            "ar_url": (f"http://127.0.0.1:5000/uploads/{ar}" if ar else None),
            "qr_url": (f"http://127.0.0.1:5000/uploads/{qr}" if qr else None),
            "price": r[6],
            "category": r[7]
        })
    conn.close()
    return jsonify(success=True, products=products)

# Agent: Delete product
@app.route("/agent/products/<int:product_id>", methods=["DELETE"])
def delete_product(product_id):
    try:
        data = request.get_json()
        agent_email = data.get("agent_email")
        
        if not agent_email:
            return jsonify(success=False, message="Agent email required")
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Check if product exists and belongs to this agent
        c.execute("SELECT agent_email FROM products WHERE id=?", (product_id,))
        result = c.fetchone()
        
        if not result:
            conn.close()
            return jsonify(success=False, message="Product not found")
        
        if result[0] != agent_email:
            conn.close()
            return jsonify(success=False, message="Not authorized to delete this product")
        
        # Delete the product
        c.execute("DELETE FROM products WHERE id=?", (product_id,))
        conn.commit()
        conn.close()
        
        return jsonify(success=True, message="Product deleted successfully")
        
    except Exception as e:
        print("Delete product error:", e)
        traceback.print_exc()
        return jsonify(success=False, message="Server error")

# Customer: View all products
@app.route("/products", methods=["GET"])
def all_products():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, name, description, image, ar_url, qr_url, agent_email, price, category FROM products")
    products = []
    for r in c.fetchall():
        img = r[3]
        ar = r[4]
        qr = r[5]
        products.append({
            "id": r[0], "name": r[1], "description": r[2],
            "image": img,
            "image_url": (f"http://127.0.0.1:5000/uploads/{img}" if img else None),
            "ar_url": (f"http://127.0.0.1:5000/uploads/{ar}" if ar else None),
            "qr_url": (f"http://127.0.0.1:5000/uploads/{qr}" if qr else None),
            "agent_email": r[6],
            "price": r[7],
            "category": r[8]
        })
    conn.close()
    return jsonify(success=True, products=products)

# Get single product by id (with resolved URLs)
@app.route("/product/<int:product_id>", methods=["GET"])
def get_product(product_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, name, description, image, ar_url, qr_url, agent_email, price, category FROM products WHERE id=?", (product_id,))
    r = c.fetchone()
    conn.close()
    if not r:
        return jsonify(success=False, message="Product not found"), 404
    img = r[3]
    ar = r[4]
    qr = r[5]
    product = {
        "id": r[0],
        "name": r[1],
        "description": r[2],
        "image": img,
        "image_url": (f"http://127.0.0.1:5000/uploads/{img}" if img else None),
        "ar_image": ar,
        "ar_image_url": (f"http://127.0.0.1:5000/uploads/{ar}" if ar else None),
        "qr_url": (f"http://127.0.0.1:5000/uploads/{qr}" if qr else None),
        "agent_email": r[6],
        "price": r[7],
        "category": r[8]
    }
    return jsonify(success=True, product=product)

# Serve uploaded images
@app.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


# Agent: Get or update profile
@app.route('/agent/profile', methods=['GET', 'POST'])
def agent_profile():
    try:
        if request.method == 'GET':
            agent_email = request.args.get('agent_email') or request.args.get('email')
            if not agent_email:
                return jsonify(success=False, message='Missing agent_email'), 400
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute('SELECT email, full_name, phone, shop_name, address, bio, payout_info, social, avatar, updated_at FROM agent_profiles WHERE email=?', (agent_email,))
            r = c.fetchone()
            conn.close()
            if not r:
                return jsonify(success=True, profile=None)
            avatar = r[8]
            profile = {
                'email': r[0], 'full_name': r[1], 'phone': r[2], 'shop_name': r[3], 'address': r[4],
                'bio': r[5], 'payout_info': r[6], 'social': r[7], 'avatar': avatar,
                'avatar_url': (f"http://127.0.0.1:5000/uploads/{avatar}" if avatar else None),
                'updated_at': r[9]
            }
            return jsonify(success=True, profile=profile)

        # POST - update or create profile
        # Expect multipart/form-data
        email = request.form.get('email') or request.form.get('agent_email')
        if not email:
            return jsonify(success=False, message='Email is required'), 400

        full_name = request.form.get('full_name')
        phone = request.form.get('phone')
        shop_name = request.form.get('shop_name')
        address = request.form.get('address')
        bio = request.form.get('bio')
        payout_info = request.form.get('payout_info')
        social = request.form.get('social')

        avatar_file = request.files.get('avatar')
        avatar_filename = None
        if avatar_file:
            safe_name = secure_filename(avatar_file.filename)
            avatar_filename = f"agent_{email}_avatar_{safe_name}"
            avatar_path = os.path.join(UPLOAD_FOLDER, avatar_filename)
            avatar_file.save(avatar_path)

        from datetime import datetime
        updated_at = datetime.now().isoformat()

        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        # Check existing
        c.execute('SELECT id, avatar FROM agent_profiles WHERE email=?', (email,))
        existing = c.fetchone()
        if existing:
            # if new avatar uploaded, replace filename; otherwise keep existing
            if avatar_filename is None:
                avatar_filename = existing[1]
            c.execute('''
                UPDATE agent_profiles SET full_name=?, phone=?, shop_name=?, address=?, bio=?, payout_info=?, social=?, avatar=?, updated_at=? WHERE email=?
            ''', (full_name, phone, shop_name, address, bio, payout_info, social, avatar_filename, updated_at, email))
        else:
            c.execute('''
                INSERT INTO agent_profiles (email, full_name, phone, shop_name, address, bio, payout_info, social, avatar, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (email, full_name, phone, shop_name, address, bio, payout_info, social, avatar_filename, updated_at))
        conn.commit()

        # return saved profile
        c.execute('SELECT email, full_name, phone, shop_name, address, bio, payout_info, social, avatar, updated_at FROM agent_profiles WHERE email=?', (email,))
        r = c.fetchone()
        conn.close()
        avatar = r[8]
        profile = {
            'email': r[0], 'full_name': r[1], 'phone': r[2], 'shop_name': r[3], 'address': r[4],
            'bio': r[5], 'payout_info': r[6], 'social': r[7], 'avatar': avatar,
            'avatar_url': (f"http://127.0.0.1:5000/uploads/{avatar}" if avatar else None),
            'updated_at': r[9]
        }
        return jsonify(success=True, message='Profile saved', profile=profile)

    except Exception as e:
        print('Agent profile error:', e)
        traceback.print_exc()
        return jsonify(success=False, message='Server error while saving profile')

# Agent: Schedule workshop (with image)
@app.route("/agent/workshops", methods=["POST"])
def post_workshop():
    try:
        print("Received workshop data:", dict(request.form))
        
        # Get form data with proper type conversion
        title = request.form.get("title", "").strip()
        description = request.form.get("description", "").strip()
        date = request.form.get("date", "").strip()
        agent_email = request.form.get("agent_email", "").strip()
        image = request.files.get("image")
        
        # Convert numeric fields
        try:
            duration = int(request.form.get("duration", 0))
            max_participants = int(request.form.get("max_participants", 0))
        except (ValueError, TypeError) as e:
            print(f"Error converting numeric fields: {e}")
            return jsonify(success=False, message="Duration and max participants must be valid numbers")
        
        mode = request.form.get("mode", "").strip()
        
        # Validate required fields
        print(f"Validating fields - Title: {bool(title)}, Description: {bool(description)}, Date: {bool(date)}, Agent: {bool(agent_email)}")
        if not all([title, description, date, agent_email]):
            missing = [f for f in ['title', 'description', 'date', 'agent_email'] 
                      if not request.form.get(f)]
            return jsonify(success=False, message=f"Required fields missing: {', '.join(missing)}")
        
        # Validate numeric ranges
        if duration <= 0:
            return jsonify(success=False, message="Duration must be greater than 0")
        if max_participants <= 0:
            return jsonify(success=False, message="Maximum participants must be greater than 0")
            
        # Handle image upload
        image_filename = None
        if image:
            image_filename = f"workshop_{agent_email}_{title}_{image.filename}"
            image_path = os.path.join(UPLOAD_FOLDER, image_filename)
            print(f"Saving image to: {image_path}")
            image.save(image_path)
            
        # Save to database
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        print("Inserting workshop with values:", {
            'agent_email': agent_email,
            'title': title,
            'description': description,
            'date': date,
            'duration': duration,
            'mode': mode,
            'max_participants': max_participants,
            'image': image_filename
        })
        
        c.execute("""
            INSERT INTO workshops 
            (agent_email, title, description, date, duration, mode, max_participants, image) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (agent_email, title, description, date, duration, mode, max_participants, image_filename))
        conn.commit()
        conn.close()
        print("Workshop saved successfully")
        
        return jsonify(success=True, message="Workshop scheduled successfully")
        
    except Exception as e:
        print("Workshop post error:", str(e))
        traceback.print_exc()
        return jsonify(success=False, message=f"Server error: {str(e)}")

# Agent: View own workshops
@app.route("/agent/workshops", methods=["GET"])
def agent_workshops():
    agent_email = request.args.get("agent_email")
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        SELECT id, title, description, date, duration, mode, max_participants, image 
        FROM workshops 
        WHERE agent_email=?
    """, (agent_email,))
    workshops = []
    for r in c.fetchall():
        img = r[7]
        workshops.append({
            "id": r[0],
            "title": r[1],
            "description": r[2],
            "date": r[3],
            "duration": r[4],
            "mode": r[5],
            "max_participants": r[6],
            "image": img,
            "image_url": (f"http://127.0.0.1:5000/uploads/{img}" if img else None)
        })
    conn.close()
    return jsonify(success=True, workshops=workshops)

# Featured artisans/agents listing
@app.route("/agents", methods=["GET"])
def list_agents():
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        # Only roles explicitly marked as agent or kalakar
        c.execute("SELECT username, email FROM users WHERE LOWER(role) IN ('agent','kalakar')")
        rows = c.fetchall()
        conn.close()
        agents = [{"name": r[0] or "KalaKar", "email": r[1]} for r in rows]
        return jsonify(success=True, agents=agents)
    except Exception as e:
        print("List agents error:", e)
        traceback.print_exc()
        try:
            conn.close()
        except Exception:
            pass
        return jsonify(success=False, message="Server error")

# Agent: Delete workshop
@app.route("/agent/workshops/<int:workshop_id>", methods=["DELETE"])
def delete_workshop(workshop_id):
    try:
        data = request.get_json()
        agent_email = data.get("agent_email")
        
        if not agent_email:
            return jsonify(success=False, message="Agent email required")
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Check if workshop exists and belongs to this agent
        c.execute("SELECT agent_email FROM workshops WHERE id=?", (workshop_id,))
        result = c.fetchone()
        
        if not result:
            conn.close()
            return jsonify(success=False, message="Workshop not found")
        
        if result[0] != agent_email:
            conn.close()
            return jsonify(success=False, message="Not authorized to delete this workshop")
        
        # Delete the workshop
        c.execute("DELETE FROM workshops WHERE id=?", (workshop_id,))
        conn.commit()
        conn.close()
        
        return jsonify(success=True, message="Workshop deleted successfully")
        
    except Exception as e:
        print("Delete workshop error:", e)
        traceback.print_exc()
        return jsonify(success=False, message="Server error")

# Customer: View all workshops
@app.route("/workshops", methods=["GET"])
def all_workshops():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, title, description, date, image, agent_email, duration, mode, max_participants FROM workshops")
    workshops = []
    for r in c.fetchall():
        img = r[4]
        workshops.append({
            "id": r[0],
            "title": r[1],
            "description": r[2],
            "date": r[3],
            "image": img,
            "image_url": (f"http://127.0.0.1:5000/uploads/{img}" if img else None),
            "agent_email": r[5],
            "duration": r[6],
            "mode": r[7],
            "max_participants": r[8]
        })
    conn.close()
    return jsonify(success=True, workshops=workshops)

# Customer: Place order
@app.route("/orders", methods=["POST"])
def place_order():
    data = request.get_json()
    product_id = data.get("product_id")
    customer_email = data.get("customer_email")
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT agent_email FROM products WHERE id=?", (product_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        return jsonify(success=False, message="Product not found")
    agent_email = row[0]
    c.execute("INSERT INTO orders (product_id, customer_email, agent_email) VALUES (?, ?, ?)",
              (product_id, customer_email, agent_email))
    conn.commit()
    conn.close()
    return jsonify(success=True, message="Order placed")

# Agent: View orders on own products
@app.route("/agent/orders", methods=["GET"])
def agent_orders():
    agent_email = request.args.get("agent_email")
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # Return orders and include product price so UI can compute revenue
    c.execute("SELECT o.id, o.product_id, o.customer_email, p.price FROM orders o JOIN products p ON o.product_id = p.id WHERE o.agent_email=?", (agent_email,))
    rows = c.fetchall()
    orders = []
    total_revenue = 0.0
    for r in rows:
        price = r[3] or 0.0
        orders.append({"id": r[0], "product_id": r[1], "customer_email": r[2], "price": price})
        try:
            total_revenue += float(price)
        except Exception:
            pass
    conn.close()
    return jsonify(success=True, orders=orders, revenue=total_revenue)


@app.route('/agent/dashboard-summary', methods=['GET'])
def agent_dashboard_summary():
    agent_email = request.args.get('agent_email')
    if not agent_email:
        return jsonify(success=False, message='Missing agent_email')
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # products count
    c.execute('SELECT COUNT(*) FROM products WHERE agent_email=?', (agent_email,))
    products_count = c.fetchone()[0] or 0
    # workshops count
    c.execute('SELECT COUNT(*) FROM workshops WHERE agent_email=?', (agent_email,))
    workshops_count = c.fetchone()[0] or 0
    # orders and revenue
    c.execute('SELECT p.price FROM orders o JOIN products p ON o.product_id = p.id WHERE o.agent_email=?', (agent_email,))
    rows = c.fetchall()
    orders_count = len(rows)
    revenue = 0.0
    for r in rows:
        try:
            revenue += float(r[0] or 0)
        except Exception:
            pass
    conn.close()
    return jsonify(success=True, products=products_count, workshops=workshops_count, orders=orders_count, revenue=revenue)

# Reviews: View and Post
@app.route("/reviews", methods=["GET", "POST"])
def reviews():
    if request.method == "GET":
        product_id = request.args.get("product_id")
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT rating, text, customer_email FROM reviews WHERE product_id=?", (product_id,))
        reviews = [{"rating": r[0], "text": r[1], "customer_email": r[2]} for r in c.fetchall()]
        conn.close()
        return jsonify(success=True, reviews=reviews)
    else:
        data = request.get_json()
        product_id = data.get("product_id")
        rating = data.get("rating")
        text = data.get("text")
        customer_email = data.get("customer_email")
        if not all([product_id, rating, text]):
            return jsonify(success=False, message="Missing fields")
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("INSERT INTO reviews (product_id, rating, text, customer_email) VALUES (?, ?, ?, ?)", 
                  (product_id, rating, text, customer_email))
        conn.commit()
        conn.close()
        return jsonify(success=True, message="Review posted")

# Feedback: Post feedback
@app.route("/feedback", methods=["POST"])
def post_feedback():
    data = request.get_json()
    customer_email = data.get("customer_email")
    product_id = data.get("product_id")
    message = data.get("message")
    if not all([customer_email, message]):
        return jsonify(success=False, message="Missing fields")
    from datetime import datetime
    date_created = datetime.now().isoformat()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT INTO feedback (customer_email, product_id, message, date_created) VALUES (?, ?, ?, ?)",
              (customer_email, product_id, message, date_created))
    conn.commit()
    conn.close()
    return jsonify(success=True, message="Feedback submitted")

# Agent: View feedback
@app.route("/agent/feedback", methods=["GET"])
def agent_feedback():
    agent_email = request.args.get("agent_email")
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # Get feedback for products created by this agent
    c.execute("""
        SELECT f.id, f.customer_email, f.message, f.date_created, p.name as product_name
        FROM feedback f
        LEFT JOIN products p ON f.product_id = p.id
        WHERE p.agent_email = ?
        ORDER BY f.date_created DESC
    """, (agent_email,))
    feedback = [
        {"id": r[0], "customer_email": r[1], "message": r[2], "date_created": r[3], "product_name": r[4]}
        for r in c.fetchall()
    ]
    conn.close()
    return jsonify(success=True, feedback=feedback)

# Workshop Enrollment: Enroll in workshop
@app.route("/workshops/enroll", methods=["POST"])
def enroll_workshop():
    data = request.get_json()
    workshop_id = data.get("workshop_id")
    customer_email = data.get("customer_email")
    
    if not all([workshop_id, customer_email]):
        return jsonify(success=False, message="Missing fields")
    
    try:
        from datetime import datetime
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Check if already enrolled
        c.execute("SELECT id FROM workshop_enrollments WHERE workshop_id=? AND customer_email=?",
                  (workshop_id, customer_email))
        if c.fetchone():
            conn.close()
            return jsonify(success=False, message="Already enrolled in this workshop")
        
        # Enroll
        enrollment_date = datetime.now().isoformat()
        c.execute("INSERT INTO workshop_enrollments (workshop_id, customer_email, enrollment_date) VALUES (?, ?, ?)",
                  (workshop_id, customer_email, enrollment_date))
        conn.commit()
        conn.close()
        return jsonify(success=True, message="Successfully enrolled in workshop")
    except Exception as e:
        print("Enrollment error:", e)
        traceback.print_exc()
        return jsonify(success=False, message="Server error")

# Get enrolled workshops for a customer
@app.route("/workshops/my-enrollments", methods=["GET"])
def get_my_enrollments():
    customer_email = request.args.get("customer_email")
    if not customer_email:
        return jsonify(success=False, message="Missing customer_email")
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        SELECT w.id, w.title, w.description, w.date, w.image, w.agent_email, we.enrollment_date
        FROM workshop_enrollments we
        JOIN workshops w ON we.workshop_id = w.id
        WHERE we.customer_email = ?
        ORDER BY we.enrollment_date DESC
    """, (customer_email,))
    
    enrollments = [
        {
            "id": r[0], "title": r[1], "description": r[2], "date": r[3],
            "image": r[4], "agent_email": r[5], "enrollment_date": r[6]
        }
        for r in c.fetchall()
    ]
    conn.close()
    return jsonify(success=True, enrollments=enrollments)

# Product Ratings: Submit rating
@app.route("/products/rate", methods=["POST"])
def submit_rating():
    data = request.get_json()
    product_id = data.get("product_id")
    customer_email = data.get("customer_email")
    rating = data.get("rating")
    review_text = data.get("review_text", "")
    
    if not all([product_id, customer_email, rating]):
        return jsonify(success=False, message="Missing fields")
    
    if not isinstance(rating, int) or rating < 1 or rating > 5:
        return jsonify(success=False, message="Rating must be between 1 and 5")
    
    try:
        from datetime import datetime
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Check if customer has bought this product
        c.execute("SELECT id FROM orders WHERE product_id=? AND customer_email=?", 
                  (product_id, customer_email))
        if not c.fetchone():
            conn.close()
            return jsonify(success=False, message="You can only rate products you have purchased")
        
        # Check if already rated
        c.execute("SELECT id FROM product_ratings WHERE product_id=? AND customer_email=?",
                  (product_id, customer_email))
        existing = c.fetchone()
        
        date_rated = datetime.now().isoformat()
        
        if existing:
            # Update existing rating
            c.execute("UPDATE product_ratings SET rating=?, review_text=?, date_rated=? WHERE product_id=? AND customer_email=?",
                      (rating, review_text, date_rated, product_id, customer_email))
        else:
            # Insert new rating
            c.execute("INSERT INTO product_ratings (product_id, customer_email, rating, review_text, date_rated) VALUES (?, ?, ?, ?, ?)",
                      (product_id, customer_email, rating, review_text, date_rated))
        
        conn.commit()
        conn.close()
        return jsonify(success=True, message="Rating submitted successfully")
    except Exception as e:
        print("Rating error:", e)
        traceback.print_exc()
        return jsonify(success=False, message="Server error")

# Get ratings for a product
@app.route("/products/ratings", methods=["GET"])
def get_product_ratings():
    product_id = request.args.get("product_id")
    if not product_id:
        return jsonify(success=False, message="Missing product_id")
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        SELECT customer_email, rating, review_text, date_rated
        FROM product_ratings
        WHERE product_id = ?
        ORDER BY date_rated DESC
    """, (product_id,))
    
    ratings = [
        {"customer_email": r[0], "rating": r[1], "review_text": r[2], "date_rated": r[3]}
        for r in c.fetchall()
    ]
    
    # Calculate average rating
    if ratings:
        avg_rating = sum(r['rating'] for r in ratings) / len(ratings)
    else:
        avg_rating = 0
    
    conn.close()
    return jsonify(success=True, ratings=ratings, average_rating=round(avg_rating, 1))

# Agent: Get ratings for their products
@app.route("/agent/product-ratings", methods=["GET"])
def agent_product_ratings():
    agent_email = request.args.get("agent_email")
    if not agent_email:
        return jsonify(success=False, message="Missing agent_email")
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        SELECT pr.product_id, p.name as product_name, pr.rating, pr.review_text, pr.customer_email, pr.date_rated
        FROM product_ratings pr
        JOIN products p ON pr.product_id = p.id
        WHERE p.agent_email = ?
        ORDER BY pr.date_rated DESC
    """, (agent_email,))
    
    ratings = [
        {
            "product_id": r[0], "product_name": r[1], "rating": r[2],
            "review_text": r[3], "customer_email": r[4], "date_rated": r[5]
        }
        for r in c.fetchall()
    ]
    
    # Calculate average rating by product
    product_stats = {}
    for r in ratings:
        pid = r['product_id']
        if pid not in product_stats:
            product_stats[pid] = {'name': r['product_name'], 'ratings': [], 'total': 0}
        product_stats[pid]['ratings'].append(r['rating'])
        product_stats[pid]['total'] += r['rating']
    
    for pid in product_stats:
        product_stats[pid]['average'] = round(product_stats[pid]['total'] / len(product_stats[pid]['ratings']), 1)
        product_stats[pid]['count'] = len(product_stats[pid]['ratings'])
    
    conn.close()
    return jsonify(success=True, ratings=ratings, product_stats=list(product_stats.values()))

if __name__ == "__main__":
    app.run(debug=True)
