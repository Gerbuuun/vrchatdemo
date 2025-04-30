use rapier3d::prelude::*;

pub fn is_on_ground(narrow_phase: &NarrowPhase, rigid_body: &RigidBody) -> bool {
    let mut touching_ground = false;
    let colliders = rigid_body.colliders();
    if !colliders.is_empty() {
        // TODO: Only one predefined collider for the player right now. Later, dynamically add colliders based on the player's model.
        let player_collider_handle = colliders[0];
        for contact_pair in narrow_phase.contact_pairs_with(player_collider_handle) {
            if contact_pair.has_any_active_contact {
                for manifold in &contact_pair.manifolds {
                    // Determine if our player's collider is the first or second in the contact pair
                    let is_player_first = contact_pair.collider1 == player_collider_handle;

                    // The normal points from the first collider to the second collider
                    // So if we're the first collider, we want the normal to point down (negative Y)
                    // If we're the second collider, we want the normal to point up (positive Y)
                    let normal_y = if is_player_first {
                        manifold.data.normal.y
                    } else {
                        -manifold.data.normal.y
                    };

                    if normal_y < -0.5 {
                        touching_ground = true;
                        break;
                    }
                }
            }
        }
    }
    touching_ground
}
