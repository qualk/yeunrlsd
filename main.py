from flask import (
    Flask,
    render_template,
    request,
    session,
    abort,
    redirect,
    send_file,
    jsonify,
)
from flask_squeeze import Squeeze
from albums import ALBUMS
import json

app = Flask(__name__, template_folder="templates", static_folder="static")

# Enable compression and minification
squeeze = Squeeze()
squeeze.init_app(app)

app.secret_key = "superdupersecretkey"

ALBUM_LOOKUP = {a["id"]: a for a in ALBUMS}


def get_album_by_id(album_id):
    return ALBUM_LOOKUP.get(album_id)


@app.route("/")
def home():
    return render_template("index.html", albums=ALBUMS)


# Album detail page
@app.route("/p/<album_id>")
def album_detail(album_id):
    album = get_album_by_id(album_id)
    if not album:
        abort(404)
    # If the client requested a simple fetch (from our client), return the fragment HTML
    if request.headers.get("Fragment-Request") == "fetch":
        return render_template("partials/album_fragment.html", album=album)

    # Otherwise redirect to home page to prevent SSE text on refresh
    return redirect("/")


@app.route("/about")
def about():
    return render_template("about.html")


@app.route("/help")
def help():
    return render_template("help.html")


@app.route("/privacy")
def privacy():
    return render_template("privacy.html")


@app.route("/terms")
def terms():
    return render_template("terms.html")


@app.route("/sw.js")
def service_worker():
    return send_file("sw.js", mimetype="application/javascript")


@app.route("/api/songs")
def get_songs():
    """Return all song URLs for service worker caching"""
    songs = []
    for album in ALBUMS:
        for song in album.get("songs", []):
            if "file" in song:
                songs.append(song["file"])
    return jsonify(songs)


@app.errorhandler(404)
def page_not_found(e):
    return render_template("404.html"), 404


@app.errorhandler(500)
def internal_error(e):
    return "Internal server error", 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
