pub mod math;
pub mod physics;
mod player;
mod world;

use physics::PHYSICS;
use player::{player as db_player, Player};
use spacetimedb::{ReducerContext, ScheduleAt, Table, TimeDuration};

const TICK_INTERVAL_MICROS: i64 = 1_000_000 / 30;

#[spacetimedb::table(name = tick_schedule, scheduled(tick))]
pub struct TickSchedule {
    #[primary_key]
    #[auto_inc]
    schedule_id: u64,

    scheduled_at: ScheduleAt,
}

#[spacetimedb::reducer(init)]
fn init(ctx: &ReducerContext) {
    // Start the tick schedule
    ctx.db.tick_schedule().insert(TickSchedule {
        schedule_id: 0,
        scheduled_at: TimeDuration::from_micros(TICK_INTERVAL_MICROS).into(),
    });
}

#[spacetimedb::reducer]
fn tick(ctx: &ReducerContext, _schedule: TickSchedule) -> Result<(), String> {
    if ctx.sender != ctx.identity() {
        log::error!("Player {} is not authorized to tick", ctx.sender);
        return Ok(());
    }

    let mut physics = PHYSICS.lock().expect("Failed to lock physics");

    for mut player in ctx.db.player().iter() {
        if let Some(rigid_body) = physics.update_player(&mut player) {
            let is_moving = rigid_body.linvel().xz().magnitude() > 0.00001;
            // TODO: Check if this is correct
            let backwards = player.input.backward && !player.input.forward;

            player.animation_state = Some(match (is_moving, backwards) {
                (true, true) => "walkingBackwards".to_string(),
                (true, false) => "walkingForwards".to_string(),
                (false, _) => "idle".to_string(),
            });
            player.position = rigid_body.position().translation.vector.into();
            ctx.db.player().identity().update(player);
        }
    }

    // Calculate the next physics state
    physics.tick();

    Ok(())
}
