export default function Footer() {
  return (
    <footer className="border-t border-cam-line py-6 mt-8">
      <div className="max-w-7xl mx-auto px-6 text-center text-cam-muted text-sm">
        <p>© {new Date().getFullYear()} Cameroon Census Data Portal</p>
        <p className="mt-1">Data provided by BUCREP and INS Cameroon</p>
      </div>
    </footer>
  );
}