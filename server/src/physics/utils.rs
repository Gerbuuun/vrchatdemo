use rapier3d::prelude::*;

pub fn is_on_ground(narrow_phase: &NarrowPhase, rigid_body: &RigidBody) -> bool {
    let mut touching_ground = false;
    // Get the player's collider handle
    let colliders = rigid_body.colliders();
    if !colliders.is_empty() {
        // TODO: Only one predefined collider for the player right now. Later, dynamically add colliders based on the player's model.
        let collider_handle = colliders[0];
        for contact_pair in narrow_phase.contact_pairs_with(collider_handle) {
            if contact_pair.has_any_active_contact {
                for manifold in &contact_pair.manifolds {
                    // If the contact normal is pointing down (meaning we're touching the ground)
                    if manifold.data.normal.y < -0.5 {
                        touching_ground = true;
                        break;
                    }
                }
            }
        }
    }
    touching_ground
}
