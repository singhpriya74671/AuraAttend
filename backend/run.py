from app import create_app, socketio

app = create_app()

if __name__ == "__main__":
    if socketio:
        socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)
    else:
        app.run(host="0.0.0.0", port=5000, debug=True)
