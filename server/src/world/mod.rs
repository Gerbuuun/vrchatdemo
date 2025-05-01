use crate::math::DbVector3;
use crate::physics::{PHYSICS, SCENE_COLLISION_GROUP};
use rapier3d::{parry::transformation::convex_hull, prelude::ColliderBuilder};
use spacetimedb::{ReducerContext, Table};

#[spacetimedb::table(name = collider, public)]
#[derive(Clone, Debug)]
pub struct Collider {
    #[primary_key]
    #[auto_inc]
    pub id: u32,

    pub positions: Vec<DbVector3>,
    pub indices: Vec<DbVector3>,
    pub name: String,
}

#[spacetimedb::reducer]
pub fn upload_body(
    ctx: &ReducerContext,
    points: Vec<DbVector3>,
    indices: Vec<DbVector3>,
    name: String,
) -> Result<(), String> {
    log::info!("Uploading body with {} points", points.len());

    let mut physics = PHYSICS.lock().expect("Failed to lock physics");

    ctx.db.collider().try_insert(Collider {
        id: 0,
        positions: points.clone(),
        name,
        indices: indices.clone(),
    })?;

    // let ch = convex_hull(&positions);

    // if let Some(builder) = ColliderBuilder::convex_hull(&ch.0) {
    //     log::info!("Adding collider with {} points", ch.0.len());
    //     physics.add_collider(builder.collision_groups(*SCENE_COLLISION_GROUP).build());
    // }

    let mut positions = Vec::new();
    for point in points {
        positions.push(rapier3d::prelude::Point::new(point.x, point.y, point.z));
    }
    let mut new_indices: Vec<[u32; 3]> = Vec::new();
    for index in indices {
        new_indices.push([index.x as u32, index.y as u32, index.z as u32]);
    }

    if let Ok(builder) = ColliderBuilder::trimesh(positions, new_indices) {
        physics.add_collider(builder.collision_groups(*SCENE_COLLISION_GROUP).build());
    }

    Ok(())
}
