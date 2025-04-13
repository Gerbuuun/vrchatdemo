pub mod math;

use math::DbVector2;
use spacetimedb::{ReducerContext, Table};

// Helper function to generate a random hex color using ReducerContext
fn generate_random_hex_color(ctx: &ReducerContext) -> String {
    // Generate random RGB values (keeping them slightly brighter by using 32-255 range)
    let r: u8 = ctx.random::<u8>() % 224 + 32; // 32-255 range
    let g: u8 = ctx.random::<u8>() % 224 + 32;
    let b: u8 = ctx.random::<u8>() % 224 + 32;
    
    // Format as hex color string
    format!("#{:02X}{:02X}{:02X}", r, g, b)
}

#[spacetimedb::table(name = player, public)]
#[spacetimedb::table(name = logged_out_player, public)]
#[derive(Clone, Debug)]
pub struct Player{
    #[primary_key]
    identity: spacetimedb::Identity,

    #[unique]
    #[auto_inc]
    player_id: u32,

    username: Option<String>,

    // Store the player's color as a hex string (e.g. "#FF00FF")
    // If not specified, this will be automatically generated on client side
    pub hex_color: Option<String>,

    pub position: DbVector2,
    pub rotation_yaw: f32,
    pub animation_state: Option<String>
}

#[spacetimedb::reducer(client_connected)]
pub fn connect(ctx: &ReducerContext) -> Result<(), String> {
    if let Some(player) = ctx.db.logged_out_player().identity().find(&ctx.sender) {
        // Make sure the player's color is preserved when reconnecting
        log::info!("Player reconnected with color: {:?}", player.hex_color);
        
        // If the player doesn't have a color, generate one now
        let player = if player.hex_color.is_none() {
            let color = generate_random_hex_color(ctx);
            log::info!("Assigning new color to reconnecting player: {}", color);
            
            let mut updated_player = player.clone();
            updated_player.hex_color = Some(color);
            updated_player
        } else {
            player.clone()
        };
        
        ctx.db.player().insert(player.clone());
        ctx.db
            .logged_out_player()
            .identity()
            .delete(&player.identity);
    } else {
        // Generate a random hex color for the new player
        let color = generate_random_hex_color(ctx);
        log::info!("Generated new color for new player: {}", color);
        
        ctx.db.player().try_insert(Player {
            identity: ctx.sender,
            player_id: 0,
            username: None,
            hex_color: Some(color),
            position: DbVector2::new(0.0, 0.0),
            rotation_yaw: 0.0,
            animation_state: None,
        })?;
    }
    Ok(())
}

#[spacetimedb::reducer(client_disconnected)]
pub fn disconnect(ctx: &ReducerContext) -> Result<(), String> {
    let player = ctx
        .db
        .player()
        .identity()
        .find(&ctx.sender)
        .ok_or("Player not found")?;

    //let player_id = player.player_id;
    ctx.db.logged_out_player().insert(player);
    ctx.db.player().identity().delete(&ctx.sender);

    Ok(())
}


//Allowing the clients to be authoritative for now (For demonstration purposes only)
#[spacetimedb::reducer]
pub fn update_player_position(ctx: &ReducerContext, position: DbVector2, rotation: f32) {
    
    if let Some(mut player) = ctx.db.player().identity().find(&ctx.sender){
        player.position = position;
        player.rotation_yaw = rotation;
        ctx.db.player().identity().update(player);
        log::info!("Updated player position");
    }
    else{
        log::error!("Player not found");
    }
}

#[spacetimedb::reducer]
pub fn update_player_animation_state(ctx: &ReducerContext, animation_state: String) {
    if let Some(mut player) = ctx.db.player().identity().find(&ctx.sender) {
        // Log the value *before* the move
        log::info!("Updating player animation state to: {}", animation_state);
        player.animation_state = Some(animation_state); // Move happens here
        // Update the player in the database
        ctx.db.player().identity().update(player);
    } else {
        log::error!("Player not found for animation update");
    }
}
