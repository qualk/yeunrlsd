import sqlite3
from flask import (
    Flask,
    render_template,
    request,
    abort,
    redirect,
    send_file,
    jsonify,
    g,
)
from flask_squeeze import Squeeze

app = Flask(__name__, template_folder="templates", static_folder="static")

# Enable compression and minification
squeeze = Squeeze()
squeeze.init_app(app)

app.secret_key = "superdupersecretkey"

DATABASE = "data/music.db"


def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()


def get_album_by_id(album_id):
    db = get_db()
    cursor = db.execute("SELECT * FROM albums WHERE id = ?", (album_id,))
    album = cursor.fetchone()
    if album:
        songs_cursor = db.execute(
            "SELECT * FROM songs WHERE album_id = ? ORDER BY id", (album_id,)
        )
        songs = songs_cursor.fetchall()
        # convert album from sqlite3.Row to dict and add songs
        album_dict = dict(album)
        album_dict["songs"] = [dict(song) for song in songs]
        return album_dict
    return None


@app.route("/")
def home():
    db = get_db()
    # Include a lightweight render-time indicator whether an album has any songs.
    cursor = db.execute(
        "SELECT a.*, EXISTS(SELECT 1 FROM songs s WHERE s.album_id = a.id) AS has_songs FROM albums a ORDER BY rowid"
    )
    albums = cursor.fetchall()
    # Convert sqlite rows to dicts so templates can read `has_songs` as a boolean-like value (0/1)
    return render_template("index.html", albums=[dict(album) for album in albums])


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
    db = get_db()
    cursor = db.execute("SELECT file FROM songs")
    songs = [row["file"] for row in cursor.fetchall() if row["file"]]
    return jsonify(songs)


@app.errorhandler(404)
def page_not_found(e):
    return render_template("404.html"), 404


@app.errorhandler(500)
def internal_error(e):
    return "Internal server error", 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
