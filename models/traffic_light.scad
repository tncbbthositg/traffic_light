/* [Light Options] */

// radius of lights
light_diffuser_radius = 20;

// LED strip width
led_strip_width = 9.5;

// how proud is the LED?
led_proudness = 2.1;

// led size
led_size = 5.4;

// margin around a light module (%)
margin_percentage = 10;

/* [Wire Options] */

// width of wire between LEDs
wire_width = 6;

// height of wire between LEDs
wire_height = 2;

// radius of usb cable
usb_cable_radius = 2.25;

/* [Case Options] */

// radius of fastening nut
fastening_nut_radius = 4;

// depth of fastening nut
fastening_nut_depth = 3.3;

// fastening screw radius
fastening_screw_radius = 2.2;

// length of fasstening screw
fastening_screw_length = 10;

/* [Mounting Options] */

// mounting screw head radius
mounting_screw_head_radius = 4.5;

// mounting screw radius
mounting_screw_radius = 2.5;

/* [Controller Options] */

// height of controller
controller_height = 7;

// width of controller
controller_width = 21;

// length of controller
controller_length = 39;

/* [Print Options] */
wall_thickness = 2.4;

print_margin = 0.2;

/* [Render Options] */

// hide debug objects
hide_debug = false;

// smoother renders slower
quality = 8; //[1: Pre-Draft, 2:Draft, 4:Medium, 8:Fine, 16:Ultra Fine]

/* [Hidden] */

margin = margin_percentage / 100 * light_diffuser_radius * 2;

// print quality settings
$fa = 12 / quality;
$fs = 2 / quality;

light_guard_radius = light_diffuser_radius + margin + wall_thickness;
light_module_size = light_guard_radius * 2 + 2 * margin;
light_guard_height = light_guard_radius * 2;

back_case_depth = light_diffuser_radius + led_proudness;
back_case_height = light_module_size * 3 - margin * 2;
back_case_thickness = back_case_depth + wall_thickness;

fastening_nut_house_length = 2 * fastening_nut_radius + 2 * wall_thickness;
fastening_nut_house_width = fastening_nut_radius * sqrt(3) + 2 * wall_thickness;
fastening_screw_hole_length = fastening_screw_length - wall_thickness + 1;

module diffuser() {
  sphere(light_diffuser_radius);
}

module light(debug_color) {
  difference() {
    color("#EEEE00")
      union() {
        translate([0, 0, wall_thickness / 2])
          cube([light_module_size, light_module_size, wall_thickness], center=true);

        cylinder(light_guard_height, r = light_guard_radius);
      }

    diffuser();

    translate([0, 0, wall_thickness])
      cylinder(light_guard_height - wall_thickness + margin, r = light_diffuser_radius + margin);

    translate([light_module_size / 2 / 2, -light_module_size / 2, wall_thickness])
      cube(light_module_size);

    translate([light_module_size / 2 / 2, -light_module_size / 2, wall_thickness])
      rotate([0, -15, 0])
        cube(light_module_size);
  }

  if(!hide_debug) {
    color(debug_color)
      diffuser();

    color("white") {
      translate([0, 0, -light_diffuser_radius - .5 * led_proudness])
        cube([led_size, led_size, led_proudness], center = true);
    }
  }
}

module fastening_points() {
  translate([0, light_module_size / 2 - fastening_nut_house_length / 2, 0]) {
    translate([-back_case_height / 2 + fastening_nut_house_width / 2, 0, 0])
      children();

    translate([back_case_height / 2 - fastening_nut_house_width / 2, 0, 0])
      children();
  }

  translate([0, -light_module_size / 2 + fastening_nut_house_length / 2, 0]) {
    translate([-back_case_height / 2 + fastening_nut_house_width / 2, 0, 0])
      children();

    translate([back_case_height / 2 - fastening_nut_house_width / 2, 0, 0])
      children();
  }
}

module face_plate() {
  difference() {
    union() {
      translate([-light_module_size + margin, 0, 0])
        light("red");

      light("yellow");

      translate([light_module_size - margin, 0, 0])
        light("green");

      // usb hole cover
      translate([light_module_size * 1.5 - margin, -usb_cable_radius + print_margin / 2, 0])
        cube([wall_thickness, usb_cable_radius * 2 - print_margin, wall_thickness]);
    }

    fastening_points()
      translate([0, 0, -wall_thickness / 2])
        cylinder(r = fastening_screw_radius, h = 2 * wall_thickness);
  }
}

module key_hole() {
  translate([0, 0, wall_thickness / 2]) {
    cylinder(r = mounting_screw_head_radius, h = 2 * wall_thickness, center = true);

    hull() {
      cube([mounting_screw_radius * 2, mounting_screw_radius * 2, 2 * wall_thickness], center = true);

      translate([-mounting_screw_head_radius * 2, 0, 0])
        cylinder(r = mounting_screw_radius, h = 2 * wall_thickness, center = true);
    }
  }
}

module hex_nut_hole() {
  rotate([0, 0, 90])
    difference() {
      translate([0, 0, back_case_thickness / 2])
        cube([fastening_nut_house_length, fastening_nut_house_width, back_case_thickness], center = true);

      translate([0, 0, back_case_thickness - fastening_nut_depth])
        cylinder(r = fastening_nut_radius, $fn = 6, h = fastening_nut_depth + 1); // extending the hole for the preview

      translate([0, 0, back_case_thickness - fastening_screw_hole_length])
        cylinder(r = fastening_screw_radius, h = fastening_screw_hole_length);
    }
}

module back_case_divider() {
  difference() {
    translate([0, -light_module_size / 2, 0])
      cube([wall_thickness, light_module_size, back_case_thickness]);

    translate([wall_thickness / 2, 0, wall_thickness + wire_height / 2])
      cube([wall_thickness * 2, wire_width, wire_height], center = true);
  }
}

module back_case() {
  color("gray")
    translate([0, 0, -back_case_thickness]) {
      fastening_points()
        hex_nut_hole();

      difference() {
        union() {
          // outer container
          translate([-back_case_height / 2 - wall_thickness, -light_module_size / 2 - wall_thickness / 2, 0])
            cube([back_case_height + 2 * wall_thickness, light_module_size + 2 * wall_thickness, back_case_thickness + wall_thickness]);


          translate([-back_case_height / 2, -light_module_size / 2, 0])
            cube([back_case_height, light_module_size, back_case_thickness]);
        }

        // face_plate hole
        translate([0, 0, back_case_thickness + wall_thickness / 2])
          cube([back_case_height + print_margin, light_module_size + print_margin, wall_thickness], center = true);

        // main container
        translate([-back_case_height / 2 + wall_thickness, -light_module_size / 2 + wall_thickness, wall_thickness])
          cube([back_case_height - 2 * wall_thickness, light_module_size - 2 * wall_thickness, back_case_depth + 1]); // extending the cut for the preview

        // usb cable port
        translate([back_case_height / 2 - wall_thickness / 2, 0, back_case_thickness - usb_cable_radius])
          rotate([0, -90, 0])
            hull() {
              translate([usb_cable_radius / 2 + wall_thickness, 0, 0])
                cube([usb_cable_radius, 2 * usb_cable_radius, 4 * wall_thickness], center = true);

              cylinder(r = usb_cable_radius, h = 4 * wall_thickness, center = true);
            }

        // back mounting holes
        translate([-light_module_size, 0, 0]) {
          translate([0, light_module_size / 3, 0])
            key_hole();

          translate([0, -light_module_size / 3, 0])
            key_hole();
        }
      }

      translate([-light_module_size / 2, 0, 0])
        back_case_divider();

      translate([light_module_size / 2 - margin, 0, 0])
        back_case_divider();
    }
}

difference() {
  union() {
    face_plate();
    back_case();

    if(!hide_debug) {
      color("black")
        translate([light_module_size / 2 - margin + controller_height / 2 + wall_thickness, 0, -controller_width / 2])
          rotate([0, 90, 180])
            cube([controller_width, controller_length, controller_height], center = true);
    }
  }

  if(!hide_debug) {
    translate([0, -500, 0])
      cube([1000, 1000, 1000], center = true);

    // translate([0, 0, 500])
    //   cube([1000, 1000, 1000], center = true);
  }
}
