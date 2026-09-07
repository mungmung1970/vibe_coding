export default function Button({ children, variant = 'secondary', ...props }) {
  return <button className={`btn btn-${variant}`} {...props}>{children}</button>;
}
