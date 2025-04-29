use crate::Player;
use nalgebra::Vector3;
use rapier3d::prelude::*;
use std::collections::HashMap;
use std::sync::LazyLock;
use std::sync::Mutex;

const MOVEMENT_SPEED: f32 = 3.0;

pub static PHYSICS: LazyLock<Mutex<Physics>> = LazyLock::new(|| Mutex::new(Physics::new()));

const SCENE_GROUP: Group = Group::GROUP_1;
const PLAYER_GROUP: Group = Group::GROUP_2;

pub static SCENE_COLLISION_GROUP: LazyLock<InteractionGroups> =
    LazyLock::new(|| InteractionGroups::new(SCENE_GROUP, Group::ALL ^ SCENE_GROUP));
pub static PLAYER_COLLISION_GROUP: LazyLock<InteractionGroups> =
    LazyLock::new(|| InteractionGroups::new(PLAYER_GROUP, Group::ALL ^ PLAYER_GROUP));

pub struct Physics {
    pub physics_pipeline: PhysicsPipeline,
    pub players: HashMap<spacetimedb::Identity, RigidBodyHandle>,

    pub gravity: Vector3<f32>,
    pub integration_parameters: IntegrationParameters,
    pub island_manager: IslandManager,
    pub broad_phase: DefaultBroadPhase,
    pub narrow_phase: NarrowPhase,
    pub rigid_body_set: RigidBodySet,
    pub collider_set: ColliderSet,
    pub impulse_joint_set: ImpulseJointSet,
    pub multibody_joint_set: MultibodyJointSet,
    pub ccd_solver: CCDSolver,
    pub query_pipeline: QueryPipeline,
    pub physics_hooks: (),
    pub event_handler: (),
}

impl Physics {
    pub fn new() -> Self {
        Self {
            physics_pipeline: PhysicsPipeline::new(),
            players: HashMap::new(),
            gravity: Vector3::new(0.0, -10.0, 0.0),
            integration_parameters: IntegrationParameters::default(),
            island_manager: IslandManager::new(),
            broad_phase: DefaultBroadPhase::new(),
            narrow_phase: NarrowPhase::new(),
            rigid_body_set: RigidBodySet::new(),
            collider_set: ColliderSet::new(),
            impulse_joint_set: ImpulseJointSet::new(),
            multibody_joint_set: MultibodyJointSet::new(),
            ccd_solver: CCDSolver::new(),
            query_pipeline: QueryPipeline::new(),
            physics_hooks: (),
            event_handler: (),
        }
    }

    // Step the physics world
    pub fn tick(&mut self) {
        self.physics_pipeline.step(
            &self.gravity,
            &self.integration_parameters,
            &mut self.island_manager,
            &mut self.broad_phase,
            &mut self.narrow_phase,
            &mut self.rigid_body_set,
            &mut self.collider_set,
            &mut self.impulse_joint_set,
            &mut self.multibody_joint_set,
            &mut self.ccd_solver,
            Some(&mut self.query_pipeline),
            &self.physics_hooks,
            &self.event_handler,
        );
    }

    // Add a collider to the physics world
    pub fn add_collider(&mut self, collider: Collider) {
        self.collider_set.insert(collider);
    }

    // Add the player to the physics world
    pub fn add_player(&mut self, player: &Player) {
        let rigid_body = RigidBodyBuilder::dynamic()
            .position(player.position())
            .translation(Vector3::new(0.0, 0.9, 0.0))
            .lock_rotations()
            .ccd_enabled(true)
            .build();
        let collider = ColliderBuilder::capsule_y(0.6, 0.3).build();
        let rigid_body_handle = self.rigid_body_set.insert(rigid_body);
        self.collider_set
            .insert_with_parent(collider, rigid_body_handle, &mut self.rigid_body_set);
        self.players.insert(player.identity, rigid_body_handle);
        log::info!("Added player to physics world: {:?}", player.identity);
    }

    // Remove the player from the physics world
    pub fn remove_player(&mut self, player: &Player) {
        if let Some(handle) = self.players.remove(&player.identity) {
            self.rigid_body_set.remove(
                handle,
                &mut self.island_manager,
                &mut self.collider_set,
                &mut self.impulse_joint_set,
                &mut self.multibody_joint_set,
                true,
            );
            log::info!("Removed player from physics world: {:?}", player.identity);
        }
    }

    // Move the player in the physics world
    pub fn update_player(&mut self, player: &Player) -> Option<&RigidBody> {
        if let Some(handle) = self.players.get_mut(&player.identity) {
            let rigid_body = self.rigid_body_set.get_mut(*handle).unwrap();
            let input = player.input;
            let mut transform = Vector3::new(
                if input.left { 1.0 } else { 0.0 } - if input.right { 1.0 } else { 0.0 },
                0.0,
                if input.forward { 1.0 } else { 0.0 } - if input.backward { 1.0 } else { 0.0 },
            );

            // Normalizing a zero vector will result in a NaN (y u no handle this edge case???)
            if transform.magnitude() > 0.0 {
                transform = transform.normalize();
            }

            transform *= MOVEMENT_SPEED;
            transform = player.position().rotation.transform_vector(&transform);
            transform.y = if input.jump && rigid_body.linvel().y.abs() <= 0.0001 {
                5.0
            } else {
                rigid_body.linvel().y
            };

            rigid_body.set_linvel(transform, false);

            Some(rigid_body)
        } else {
            None
        }
    }
}
