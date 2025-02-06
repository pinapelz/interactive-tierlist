use actix_files as fs;
use actix_web::{web, App, HttpResponse, HttpServer, Result};
use tera::Tera;

async fn index(templates: web::Data<Tera>) -> Result<HttpResponse> {
    let mut context = tera::Context::new();
    context.insert("name", "World");

    let rendered = templates
        .render("index.html", &context)
        .map_err(|e| {
            eprintln!("Template rendering error: {}", e);
            actix_web::error::ErrorInternalServerError("Template rendering error")
        })?;

    Ok(HttpResponse::Ok().content_type("text/html").body(rendered))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let tera = Tera::new("templates/**/*").expect("Error initializing Tera");

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(tera.clone()))
            .route("/", web::get().to(index))
            .service(fs::Files::new("/static", "./static").show_files_listing())
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
