use spacetimedb::ReducerContext;

// Helper function to generate a random hex color using ReducerContext
pub fn generate_random_hex_color(ctx: &ReducerContext) -> String {
    // Generate random RGB values (keeping them slightly brighter by using 32-255 range)
    let r: u8 = ctx.random::<u8>() % 224 + 32; // 32-255 range
    let g: u8 = ctx.random::<u8>() % 224 + 32;
    let b: u8 = ctx.random::<u8>() % 224 + 32;

    // Format as hex color string
    format!("#{:02X}{:02X}{:02X}", r, g, b)
}
