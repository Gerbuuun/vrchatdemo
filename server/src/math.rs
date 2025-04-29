use nalgebra::{Point3, Vector3};
use spacetimedb::SpacetimeType;

#[derive(SpacetimeType, Debug, Clone, Copy)]
pub struct DbVector3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

impl DbVector3 {
    pub fn new(x: f32, y: f32, z: f32) -> Self {
        Self { x, y, z }
    }
}

// Convert between DbVector3 and nalgebra::Vector3<f32>
impl From<DbVector3> for Vector3<f32> {
    fn from(vector3: DbVector3) -> Self {
        Vector3::new(vector3.x, vector3.y, vector3.z)
    }
}

// Convert between nalgebra::Vector3<f32> and DbVector3
impl From<Vector3<f32>> for DbVector3 {
    fn from(vector3: Vector3<f32>) -> Self {
        Self {
            x: vector3.x,
            y: vector3.y,
            z: vector3.z,
        }
    }
}

impl From<DbVector3> for Point3<f32> {
    fn from(vector3: DbVector3) -> Self {
        Point3::new(vector3.x, vector3.y, vector3.z)
    }
}
