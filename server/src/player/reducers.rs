use crate::physics::PHYSICS;
use crate::player::utils;
use crate::player::{logged_out_player, player, InputState, Player};
use spacetimedb::{ReducerContext, Table};

#[spacetimedb::reducer(client_connected)]
pub fn connect(ctx: &ReducerContext) -> Result<(), String> {
    let mut physics = PHYSICS.lock().expect("Failed to lock physics");
    if let Some(player) = ctx.db.logged_out_player().identity().find(&ctx.sender) {
        // Make sure the player's color is preserved when reconnecting
        log::info!("Player reconnected with color: {:?}", player.hex_color);

        // If the player doesn't have a color, generate one now
        let player = if player.hex_color.is_none() {
            let color = utils::generate_random_hex_color(ctx);
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

        // Add the player to the physics world
        physics.add_player(&player);
    } else {
        // Create a new player
        let player = Player::new(ctx);

        // Add the player to the physics world
        physics.add_player(&player);

        ctx.db.player().try_insert(player)?;
    }
    Ok(())
}

#[spacetimedb::reducer(client_disconnected)]
pub fn disconnect(ctx: &ReducerContext) -> Result<(), String> {
    let mut physics = PHYSICS.lock().expect("Failed to lock physics");
    let player = ctx
        .db
        .player()
        .identity()
        .find(&ctx.sender)
        .ok_or("Player not found")?;

    // Remove the player from the physics world
    physics.remove_player(&player);

    //let player_id = player.player_id;
    ctx.db.logged_out_player().insert(player);
    ctx.db.player().identity().delete(&ctx.sender);

    Ok(())
}

#[spacetimedb::reducer]
pub fn update_player_input(ctx: &ReducerContext, input: InputState, rotation: f32) {
    if let Some(mut player) = ctx.db.player().identity().find(&ctx.sender) {
        player.input = input;
        player.rotation_yaw = rotation;
        ctx.db.player().identity().update(player);
        log::info!("Updated player input {:?}", input);
    } else {
        log::error!("Player not found");
    }
}
