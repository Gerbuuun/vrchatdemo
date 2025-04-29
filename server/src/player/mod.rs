pub mod reducers;
pub mod utils;

use crate::math::DbVector3;
use nalgebra::{Isometry3, Translation3, UnitQuaternion, Vector3};
use spacetimedb::{ReducerContext, SpacetimeType};

#[spacetimedb::table(name = player, public)]
#[spacetimedb::table(name = logged_out_player, public)]
#[derive(Clone, Debug)]
pub struct Player {
    #[primary_key]
    pub identity: spacetimedb::Identity,

    #[unique]
    #[auto_inc]
    player_id: u32,

    username: Option<String>,

    // Store the player's color as a hex string (e.g. "#FF00FF")
    // If not specified, this will be automatically generated on client side
    pub hex_color: Option<String>,

    pub position: DbVector3,
    pub rotation_yaw: f32,
    pub animation_state: Option<String>,
    pub input: InputState,
}

impl Player {
    pub fn new(ctx: &ReducerContext) -> Self {
        let color = utils::generate_random_hex_color(ctx);
        log::info!("Generated new color for new player: {}", color);

        Self {
            identity: ctx.sender,
            player_id: 0,
            username: None,
            hex_color: Some(color),
            position: DbVector3::new(0.0, 200.0, 0.0),
            rotation_yaw: 0.0,
            animation_state: None,
            input: InputState::new(),
        }
    }

    pub fn position(&self) -> Isometry3<f32> {
        Isometry3::from_parts(
            Translation3::new(self.position.x, self.position.y, self.position.z),
            UnitQuaternion::from_axis_angle(&Vector3::y_axis(), self.rotation_yaw),
        )
    }
}

// Data structure that represents the player's input state
// Used to determine the player's next position / action
#[derive(SpacetimeType, Debug, Clone, Copy)]
pub struct InputState {
    pub forward: bool,
    pub backward: bool,
    pub left: bool,
    pub right: bool,
    pub jump: bool,
    pub is_pointer_locked: bool,
}

impl InputState {
    pub fn new() -> Self {
        Self {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            is_pointer_locked: false,
        }
    }
}
