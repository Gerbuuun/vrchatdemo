use crate::math::DbVector3;
use crate::physics::PHYSICS;
use rapier3d::{
    parry::transformation::convex_hull,
    prelude::{ColliderBuilder, Group, InteractionGroups},
};
use spacetimedb::{ReducerContext, Table};

#[spacetimedb::table(name = collider, public)]
#[derive(Clone, Debug)]
pub struct Collider {
    #[primary_key]
    #[auto_inc]
    pub id: u32,

    pub positions: Vec<DbVector3>,
    pub name: String,
}

#[spacetimedb::reducer]
pub fn upload_body(
    ctx: &ReducerContext,
    points: Vec<DbVector3>,
    name: String,
) -> Result<(), String> {
    log::info!("Uploading body with {} points", points.len());

    let collision_group = InteractionGroups::new(Group::GROUP_1, Group::ALL ^ Group::GROUP_1);
    let mut physics = PHYSICS.lock().expect("Failed to lock physics");

    let mut positions = Vec::new();
    for point in points {
        positions.push(rapier3d::prelude::Point::new(point.x, point.y, point.z));
    }

    ctx.db.collider().try_insert(Collider {
        id: 0,
        positions: positions
            .iter()
            .map(|p| DbVector3::new(p.x, p.y, p.z))
            .collect(),
        name,
    })?;

    let ch = convex_hull(&positions);

    if let Some(builder) = ColliderBuilder::convex_hull(&ch.0) {
        log::info!("Adding collider with {} points", ch.0.len());
        physics.add_collider(builder.collision_groups(collision_group).build());
    }

    Ok(())
}
