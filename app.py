from flask import Flask, render_template, request, session, jsonify, abort, redirect
from datastar_sse import datastar_merge_fragment
from datastar_broadcast import register_queue, unregister_queue, publish
import queue
from datastar_py.sse import SSE_HEADERS, ServerSentEventGenerator as SSE
from flask_compress import Compress
from products import PRODUCTS, SIZES, PRODUCT_PRICES

app = Flask(__name__, template_folder='templates', static_folder='static')

# Enable compression
Compress(app)

app.secret_key = 'superdupersecretkey'

# Create product lookup dict for faster access
PRODUCT_LOOKUP = {p['id']: p for p in PRODUCTS}

def get_product_by_id(product_id):
    return PRODUCT_LOOKUP.get(product_id)

def get_cart():
    return session.get('cart', [])

def save_cart(cart):
    session['cart'] = cart
    session.modified = True

def get_cart_total():
    cart = get_cart()
    return sum(PRODUCT_PRICES.get(item['id'], 20) * item['quantity'] for item in cart)

def get_cart_quantity():
    cart = get_cart()
    return sum(item['quantity'] for item in cart)

@app.route('/')
def home():
    return render_template('index.html', products=PRODUCTS, cart_quantity=get_cart_quantity())


# Datastar SSE endpoint for product detail
@app.route('/p/<product_id>')
def product_detail(product_id):
    product = get_product_by_id(product_id)
    if not product:
        abort(404)
    # If the client requested a simple fetch (from our Datastar client), return the fragment HTML
    if request.headers.get('X-Datastar-Action') == 'fetch':
        return render_template('product_fragment.html', product=product, sizes=SIZES, cart_quantity=get_cart_quantity())

    # Otherwise redirect to home page to prevent SSE text on refresh
    return redirect('/')


@app.route('/datastar')
def datastar_stream():
    """SSE endpoint that streams published datastar events to connected clients."""
    q = queue.Queue()
    register_queue(q)

    def gen():
        try:
            while True:
                event = q.get()
                if event is None:
                    break
                yield event
        finally:
            unregister_queue(q)

    return app.response_class(gen(), headers=SSE_HEADERS, mimetype='text/event-stream')


def publish_patch(html, selector=None, mode=None):
    """Render a patch event and publish it to all SSE subscribers."""
    event = SSE.patch_elements(elements=html, selector=selector, mode=mode)
    publish(event)


@app.route('/_push_product/<product_id>')
def push_product(product_id):
    """Test helper: render and push product fragment to all clients."""
    product = get_product_by_id(product_id)
    if not product:
        abort(404)
    html = render_template('product_fragment.html', product=product, sizes=SIZES, cart_quantity=get_cart_quantity())
    publish_patch(html, selector="#product-detail")
    return ('', 204)

@app.route('/about')
def about():
    return render_template('about.html', cart_quantity=get_cart_quantity())

@app.route('/help')
def help():
    return render_template('help.html', cart_quantity=get_cart_quantity())

@app.route('/privacy')
def privacy():
    return render_template('privacy.html', cart_quantity=get_cart_quantity())

@app.route('/terms')
def terms():
    return render_template('terms.html', cart_quantity=get_cart_quantity())

@app.route('/api/cart/add', methods=['POST'])
def add_to_cart():
    try:
        data = request.get_json()
        if not data:
            abort(400, 'No data provided')

        product_id = data.get('product_id')
        size = data.get('size')

        if not product_id or size is None:
            abort(400, 'Missing product_id or size')

        if not get_product_by_id(product_id):
            abort(400, 'Invalid product')
        if size not in [s['value'] for s in SIZES]:
            abort(400, 'Invalid size')

        cart = get_cart()
        existing_item = next((item for item in cart if item['id'] == product_id and item['size'] == size), None)
        
        if existing_item:
            existing_item['quantity'] += 1
        else:
            product = get_product_by_id(product_id)
            cart.append({
                'id': product_id,
                'name': product['name'],
                'image': product['image'],
                'size': size,
                'quantity': 1
            })
        
        save_cart(cart)
        return jsonify({'cart_quantity': get_cart_quantity()})

    except Exception as e:
        app.logger.error(f'Error adding to cart: {e}')
        abort(500)

@app.route('/api/cart/update', methods=['POST'])
def update_cart():
    try:
        data = request.get_json()
        if not data:
            abort(400, 'No data provided')

        product_id = data.get('product_id')
        size = data.get('size')
        change = data.get('change', 0)

        if not product_id or size is None or not isinstance(change, int):
            abort(400, 'Invalid data')

        if not get_product_by_id(product_id):
            abort(400, 'Invalid product')
        if size not in [s['value'] for s in SIZES]:
            abort(400, 'Invalid size')

        cart = get_cart()
        for i, item in enumerate(cart):
            if item['id'] == product_id and item['size'] == size:
                item['quantity'] += change
                if item['quantity'] <= 0:
                    cart.pop(i)
                break
        else:
            abort(400, 'Item not in cart')
        
        save_cart(cart)
        return jsonify({'cart': cart, 'total': get_cart_total(), 'cart_quantity': get_cart_quantity()})

    except Exception as e:
        app.logger.error(f'Error updating cart: {e}')
        abort(500)

@app.route('/api/cart')
def get_cart_api():
    cart = get_cart()
    # Add price to each cart item
    for item in cart:
        item['price'] = PRODUCT_PRICES.get(item['id'], 20)
    return jsonify({
        'cart': cart,
        'total': get_cart_total(),
        'cart_quantity': get_cart_quantity()
    })

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html', cart_quantity=get_cart_quantity()), 404

@app.errorhandler(500)
def internal_error(e):
    return "Internal server error", 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)