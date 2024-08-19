/*
 * Project myProject
 * Author: Patrick Caldwell
 * Date:
 * For comprehensive documentation and examples, please visit:
 * https://docs.particle.io/firmware/best-practices/firmware-template/
 */

// Include Particle Device OS APIs
#include "Particle.h"
// #include <lib/neopixel/src/neopixel.h>
#include "neopixel.h"

#define PIXEL_COUNT 3
#define PIXEL_PIN D2
#define PIXEL_TYPE WS2812B

// Let Device OS manage the connection to the Particle Cloud
SYSTEM_MODE(AUTOMATIC);

// Run the application and system concurrently in separate threads
SYSTEM_THREAD(ENABLED);

// Show system, cloud connectivity, and application logs over USB
// View logs with CLI using 'particle serial monitor --follow'
SerialLogHandler logHandler(LOG_LEVEL_INFO);

enum UserStatus {
  USER_STATUS_AVAILABLE = 0,
  USER_STATUS_BUSY,
  USER_STATUS_DO_NOT_DISTURB,
};

enum UserStatus status = USER_STATUS_AVAILABLE;
LEDStatus onboardLED;

Adafruit_NeoPixel lights(PIXEL_COUNT, PIXEL_PIN, PIXEL_TYPE);

enum TrafficLight {
  TRAFFIC_LIGHT_GREEN = 0,
  TRAFFIC_LIGHT_YELLOW,
  TRAFFIC_LIGHT_RED,
};

int brightness = 0xFF;

int setAvailable(String _extra);
int setBusy(String _extra);
int setDoNotDisturb(String _extra);
int setBrightness(String brightness);
void showStatus();

void setup() {
  pinMode(PIXEL_PIN, OUTPUT);

  lights.begin();
  lights.setBrightness(brightness);
  lights.clear();
  lights.show();

  Particle.connect();
  Particle.variable("status", status);

  Particle.function("setAvailable", setAvailable);
  Particle.function("setBusy", setBusy);
  Particle.function("setDoNotDisturb", setDoNotDisturb);

  Particle.function("setBrightness", setBrightness);
}

void loop() {
  // Example: Publish event to cloud every 10 seconds. Uncomment the next 3 lines to try it!
  showStatus();
  delay(10);
}

void showStatus() {
  lights.clear();

  lights.setBrightness(brightness);

  switch(status) {
    case USER_STATUS_AVAILABLE:
      onboardLED.setColor(RGB_COLOR_GREEN);
      lights.setPixelColor(TRAFFIC_LIGHT_GREEN, RGB_COLOR_GREEN);
      break;

    case USER_STATUS_BUSY:
      onboardLED.setColor(RGB_COLOR_YELLOW);
      lights.setPixelColor(TRAFFIC_LIGHT_YELLOW, RGB_COLOR_YELLOW);
      break;

    case USER_STATUS_DO_NOT_DISTURB:
      onboardLED.setColor(RGB_COLOR_RED);
      lights.setPixelColor(TRAFFIC_LIGHT_RED, RGB_COLOR_RED);
      break;
  }

  onboardLED.setPattern(LED_PATTERN_SOLID);
  lights.show();

  if (!onboardLED.isActive()) {
    onboardLED.setActive(true);
  }
}

int setAvailable(String _extra) {
  status = USER_STATUS_AVAILABLE;
  Log.info("You are now available.");
  Particle.publish("status_changed", String::format("%d", status));
  return 1;
}

int setBusy(String _extra) {
  status = USER_STATUS_BUSY;
  Log.info("You are now busy.");
  Particle.publish("status_changed", String::format("%d", status));
  return 1;
}

int setDoNotDisturb(String _extra) {
  status = USER_STATUS_DO_NOT_DISTURB;
  Log.info("You are now set to do not disturb.");
  Particle.publish("status_changed", String::format("%d", status));
  return 1;
}

int setBrightness(String newBrightness) {
  brightness = newBrightness.toInt();
  Log.info(String::format("Brightness has been changed: %d", brightness));
  Particle.publish("brightness_changed", String::format("%d", brightness));
  return brightness;
}
