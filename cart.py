from flask import session

class Cart:
    @staticmethod
    def get():
        return session.get('cart', [])

    @staticmethod
    def save(cart):
        session['cart'] = cart

    @staticmethod
    def add_item(product_id, size, product):
        cart = Cart.get()
        existing_item = next((item for item in cart if item['id'] == product_id and item['size'] == size), None)

        if existing_item:
            existing_item['quantity'] += 1
        else:
            cart.append({
                'id': product_id,
                'name': product['name'],
                'image': product['image'],
                'size': size,
                'quantity': 1
            })

        Cart.save(cart)
        return Cart.get_quantity()

    @staticmethod
    def update_item(product_id, size, change):
        cart = Cart.get()
        for item in cart:
            if item['id'] == product_id and item['size'] == size:
                item['quantity'] += change
                if item['quantity'] <= 0:
                    cart.remove(item)
                break
        Cart.save(cart)
        return cart, Cart.get_total(), Cart.get_quantity()

    @staticmethod
    def get_total():
        cart = Cart.get()
        total = 0
        for item in cart:
            price = 40 if item['id'].startswith('sk') and 'gray' in item['id'] else 20
            total += price * item['quantity']
        return total

    @staticmethod
    def get_quantity():
        cart = Cart.get()
        return sum(item['quantity'] for item in cart)