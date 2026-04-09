def headers_set(response):
    response.headers["Service-Worker-Allowed"] = "/"

    # Это позволит загружать Monaco с CDN cdnjs
    response.headers["Cross-Origin-Embedder-Policy"] = "credentialless"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"

    return response
