import { haloRadiusForBody, kmToWorldUnits } from "../../../src/scene/sceneScale";


test("keeps true body proportions while enforcing a visible interaction halo", () => {
  const plutoRadius = kmToWorldUnits(1188.3);
  const earthRadius = kmToWorldUnits(6378.1);

  expect(earthRadius).toBeGreaterThan(plutoRadius);
  expect(haloRadiusForBody(plutoRadius)).toBeGreaterThan(plutoRadius);
});

