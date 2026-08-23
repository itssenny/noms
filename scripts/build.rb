require 'fileutils'
FileUtils.rm_rf('dist')
FileUtils.mkdir_p('dist/db')
FileUtils.mkdir_p('dist/server')
FileUtils.mkdir_p('dist/.openai')
%w[index.html styles.css app.js auth.js supabase-client.js supabase-config.example.js ARCHITECTURE.md].each{|f|FileUtils.cp(f,"dist/#{f}")}
FileUtils.cp('supabase-config.local.js','dist/supabase-config.local.js') if File.exist?('supabase-config.local.js')
FileUtils.cp('db/schema.sql','dist/db/schema.sql')
FileUtils.cp('.openai/hosting.json','dist/.openai/hosting.json')
File.write('dist/server/index.js', <<~JS)
  export default { async fetch(request, env) { return env.ASSETS.fetch(request); } };
JS
puts 'Built dist/'
