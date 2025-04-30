use gltf::Gltf;
use nalgebra::Transform3;
use rapier3d::{parry, prelude::*};

// Read the primitive data from the gltf file and return the positions and indices.
fn read_primitive(
    vertex_offset: u32,
    primitive: &gltf::mesh::Primitive,
    buffers: &[gltf::buffer::Data],
) -> Option<(Vec<Point<f32>>, Vec<[u32; 3]>)> {
    let reader = primitive.reader(|buffer| Some(&buffers[buffer.index()]));
    let positions: Vec<Point<f32>> = if let Some(ps) = reader.read_positions() {
        ps.map(|p| Point::new(p[0], p[1], p[2])).collect()
    } else {
        return None;
    };

    let mut indices = Vec::new();
    match primitive.mode() {
        gltf::mesh::Mode::Triangles => {
            if let Some(is) = reader.read_indices() {
                let mut iter = is.into_u32();
                while let (Some(a), Some(b), Some(c)) = (iter.next(), iter.next(), iter.next()) {
                    indices.push([a + vertex_offset, b + vertex_offset, c + vertex_offset]);
                }
            } else {
                for i in 0..positions.len() as u32 / 3 {
                    let base = i * 3;
                    indices.push([
                        base + vertex_offset,
                        base + 1 + vertex_offset,
                        base + 2 + vertex_offset,
                    ]);
                }
            }
        }
        gltf::mesh::Mode::TriangleStrip => {
            if let Some(is) = reader.read_indices() {
                let mut iter = is.into_u32();
                while let (Some(a), Some(b), Some(c)) = (iter.next(), iter.next(), iter.next()) {
                    indices.push([a + vertex_offset, b + vertex_offset, c + vertex_offset]);
                }
            } else {
                for i in 0..positions.len() as u32 - 2 {
                    if i % 2 == 0 {
                        indices.push([
                            i + vertex_offset,
                            i + 1 + vertex_offset,
                            i + 2 + vertex_offset,
                        ]);
                    } else {
                        indices.push([
                            i + vertex_offset,
                            i + 2 + vertex_offset,
                            i + 1 + vertex_offset,
                        ]);
                    }
                }
            }
        }
        gltf::mesh::Mode::TriangleFan => {
            if let Some(is) = reader.read_indices() {
                let mut iter = is.into_u32();
                while let (Some(a), Some(b), Some(c)) = (iter.next(), iter.next(), iter.next()) {
                    indices.push([a + vertex_offset, b + vertex_offset, c + vertex_offset]);
                }
            } else {
                let center = vertex_offset;
                for i in 1..positions.len() as u32 - 1 {
                    indices.push([center, i + vertex_offset, i + 1 + vertex_offset]);
                }
            }
        }
        _ => {
            return None;
        }
    }

    Some((positions, indices))
}

// Build a Rapier3D collider from a gltf mesh.
fn points_from_mesh(
    mesh: &gltf::mesh::Mesh,
    buffers: &[gltf::buffer::Data],
    transform: &Transform3<f32>,
) -> (Vec<Point<f32>>, Vec<[u32; 3]>) {
    let mut positions = Vec::new();
    let mut indices = Vec::new();
    let mut vertex_offset = 0;

    for primitive in mesh.primitives() {
        if let Some((ps, is)) = read_primitive(vertex_offset, &primitive, buffers) {
            let transformed_points = ps
                .into_iter()
                .map(|p| transform.transform_point(&p))
                .collect::<Vec<_>>();

            positions.extend(transformed_points);
            indices.extend(is);
            vertex_offset = positions.len() as u32;
        }
    }

    (positions, indices)
}

fn place_colliders<'a>(
    node: &gltf::scene::Node<'a>,
    buffers: &[gltf::buffer::Data],
    transform: &Transform3<f32>,
) -> Vec<(Vec<Point<f32>>, Vec<[u32; 3]>, String)> {
    let mut shapes = Vec::<(Vec<Point<f32>>, Vec<[u32; 3]>, String)>::new();

    let node_matrix = nalgebra::Matrix4::from(node.transform().matrix());
    let node_transform = Transform3::from_matrix_unchecked(node_matrix);
    let combined_transform = transform * node_transform;

    for child in node.children() {
        let children = place_colliders(&child, buffers, &combined_transform);
        shapes.extend(children);
    }

    if let Some(mesh) = node.mesh() {
        let (positions, indices) = points_from_mesh(&mesh, buffers, &combined_transform);
        shapes.push((
            positions,
            indices,
            node.name().unwrap_or("unnamed").to_string(),
        ));
    }

    println!(
        "Node: {:?}, {:?}",
        node.name().unwrap_or("unnamed"),
        shapes.len()
    );

    shapes
}

pub fn load_scene(path: &str) -> Vec<(Vec<Point<f32>>, String)> {
    if let Ok(gltf) = Gltf::open(path) {
        let scenes = gltf.scenes().collect::<Vec<_>>();

        let base_path = std::path::Path::new(path)
            .parent()
            .unwrap_or_else(|| std::path::Path::new("."));

        // Only import buffers. We don't need images.
        let buffers = gltf::import_buffers(&gltf.document, Some(base_path), None)
            .expect("Failed to import buffers");

        let mut colliders = Vec::new();
        let scale = Transform3::from_matrix_unchecked(nalgebra::Matrix4::new_scaling(4.0));

        // Place colliders in the scene based on the nodes.
        for scene in scenes {
            for node in scene.nodes() {
                let node_colliders = place_colliders(&node, &buffers, &scale);
                colliders.extend(node_colliders);
            }
        }

        colliders
            .into_iter()
            .map(|(positions, _, name)| (parry::transformation::convex_hull(&positions).0, name))
            .collect::<Vec<_>>()
    } else {
        log::error!("Failed to load scene from {}", path);
        Vec::new()
    }
}
