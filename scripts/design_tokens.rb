require 'json'
# Small build-time bridge: platform-neutral values remain the source of truth.
def write_design_tokens(root = File.expand_path('..', __dir__))
  tokens = JSON.parse(File.read(File.join(root, 'design/noms.tokens.json')))
  kebab = ->(name) { name.gsub(/([a-z0-9])([A-Z])/, '\\1-\\2').downcase }
  rows = tokens.fetch('colors').map { |name, value| "  --noms-#{kebab.call(name)}:#{value};" }
  rows += tokens.fetch('spacing').map { |value| "  --noms-space-#{value}:#{value}px;" }
  tokens.fetch('typography').fetch('roles').each do |name, role|
    rows << "  --noms-type-#{kebab.call(name)}:#{role.fetch('size')}px;"
    rows << "  --noms-type-#{kebab.call(name)}-compact:#{role['compactSize']}px;" if role['compactSize']
  end
  tokens.fetch('gradients').each do |name, gradient|
    stops = gradient.fetch('stops').map { |stop| "#{stop.fetch('color')} #{(stop.fetch('offset') * 100).round(2)}%" }.join(',')
    rows << "  --noms-gradient-#{kebab.call(name)}:linear-gradient(#{gradient.fetch('angleDegrees')}deg,#{stops});"
  end
  File.write(File.join(root, 'design-tokens.css'), "/* Generated from design/noms.tokens.json. Run ruby scripts/design_tokens.rb. */\n:root{\n#{rows.join("\n")}\n}\n")
end
write_design_tokens if $PROGRAM_NAME == __FILE__
