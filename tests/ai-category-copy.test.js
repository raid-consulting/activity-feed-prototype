const assert = require('assert');
const path = require('path');
const categories = require(path.join('..', 'ai-category-constants.js'));

function test(name, fn){
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err){
    console.error(`✗ ${name}`);
    throw err;
  }
}

['green', 'red', 'blue', 'grey'].forEach(key => {
  test(`presentation data matches copy for ${key}`, () => {
    const copy = categories.AI_CATEGORY_COPY[key];
    const presentation = categories.getCategoryPresentation(key);
    assert.ok(copy, 'copy exists');
    assert.strictEqual(presentation.title, copy.title);
    assert.strictEqual(presentation.description, copy.desc);
    assert.strictEqual(presentation.themeClass, `category-theme-${key}`);
    assert.strictEqual(presentation.ariaLabel, copy.title);
  });
});

test('unknown categories fall back to grey copy', () => {
  const presentation = categories.getCategoryPresentation('purple');
  assert.strictEqual(presentation.key, 'grey');
  assert.strictEqual(presentation.themeClass, 'category-theme-grey');
  assert.strictEqual(presentation.title, categories.AI_CATEGORY_COPY.grey.title);
});
